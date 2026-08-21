#!/usr/bin/env python3
"""
KAIRON AWS control plane.

Provisions and manages the single-EC2 deployment described in
docs/DEPLOYMENT.md: one instance in the default VPC running three containers
(nginx+SPA, api, postgres) behind one Elastic IP.

Everything it creates is tagged Project=kairon, so `destroy` can find and
remove all of it without guesswork.

Usage:
    ./kairon.py provision          # create all AWS resources (idempotent)
    ./kairon.py status             # what exists right now + health check
    ./kairon.py github-oidc        # let GitHub Actions assume an AWS role (no static keys)
    ./kairon.py secrets            # push deploy secrets to the GitHub repo
    ./kairon.py deploy             # pull latest images + restart (manual deploy)
    ./kairon.py migrate            # prisma migrate deploy, on the instance
    ./kairon.py seed               # DESTRUCTIVE: rebuild demo data on the instance
    ./kairon.py logs [service]     # tail container logs
    ./kairon.py ssh                # interactive shell on the instance
    ./kairon.py destroy            # remove every AWS resource this created
"""

from __future__ import annotations

import argparse
import json
import os
import secrets
import shutil
import stat
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:  # pragma: no cover - guidance path only
    sys.exit(
        "boto3 is not installed.\n"
        "Run:  infra/aws/.venv/bin/python infra/aws/kairon.py ...\n"
        "or:   python3 -m venv infra/aws/.venv && infra/aws/.venv/bin/pip install boto3"
    )

# --------------------------------------------------------------------------
# constants / paths
# --------------------------------------------------------------------------

REGION = os.environ.get("AWS_REGION", "ap-south-1")
PROJECT = "kairon"
INSTANCE_TYPE = os.environ.get("KAIRON_INSTANCE_TYPE", "t3.small")
KEY_NAME = f"{PROJECT}-ec2"
SG_NAME = f"{PROJECT}-sg"
ROLE_NAME = f"{PROJECT}-github-actions"
# Amazon's own SSM parameter always points at the current AL2023 image, so we
# never hardcode an AMI id that goes stale.
AMI_SSM_PARAM = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent
STATE_FILE = HERE / ".state.json"
SECRETS_DIR = HERE / ".secrets"
KEY_FILE = SECRETS_DIR / f"{KEY_NAME}.pem"

REMOTE_DIR = "/opt/kairon"
SSH_USER = "ec2-user"

GITHUB_OIDC_URL = "https://token.actions.githubusercontent.com"
GITHUB_OIDC_AUDIENCE = "sts.amazonaws.com"


# --------------------------------------------------------------------------
# small helpers
# --------------------------------------------------------------------------

def info(msg: str) -> None:
    print(f"  {msg}")


def step(msg: str) -> None:
    print(f"\n\033[1m{msg}\033[0m")


def ok(msg: str) -> None:
    print(f"  \033[32m✓\033[0m {msg}")


def warn(msg: str) -> None:
    print(f"  \033[33m!\033[0m {msg}")


def die(msg: str) -> "NoReturn":  # type: ignore[valid-type]
    sys.exit(f"\033[31merror:\033[0m {msg}")


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {}


def save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state, indent=2) + "\n")


def tags(kind: str) -> list[dict]:
    return [
        {"Key": "Project", "Value": PROJECT},
        {"Key": "Name", "Value": f"{PROJECT}-{kind}"},
        {"Key": "ManagedBy", "Value": "infra/aws/kairon.py"},
    ]


def my_public_ip() -> str:
    with urllib.request.urlopen("https://checkip.amazonaws.com", timeout=10) as r:
        return r.read().decode().strip()


def session():
    return boto3.Session(region_name=REGION)


def require_credentials() -> tuple[str, str]:
    """Returns (account_id, arn). Exits with guidance if creds are missing."""
    try:
        ident = session().client("sts").get_caller_identity()
        return ident["Account"], ident["Arn"]
    except Exception as exc:  # noqa: BLE001 - want the raw reason shown
        die(
            f"AWS credentials are not usable ({exc}).\n"
            "  Configure them first:  aws configure\n"
            f"  (region should be {REGION})"
        )


def repo_slug() -> str:
    """owner/name of the git remote, used for GHCR image names and gh calls."""
    url = subprocess.run(
        ["git", "remote", "get-url", "origin"],
        cwd=REPO_ROOT, capture_output=True, text=True, check=True,
    ).stdout.strip()
    slug = url.removeprefix("https://github.com/").removeprefix("git@github.com:")
    return slug.removesuffix(".git")


# --------------------------------------------------------------------------
# ssh plumbing
# --------------------------------------------------------------------------

def ssh_base(host: str) -> list[str]:
    return [
        "ssh",
        "-i", str(KEY_FILE),
        "-o", "StrictHostKeyChecking=accept-new",
        "-o", "UserKnownHostsFile=" + str(SECRETS_DIR / "known_hosts"),
        "-o", "ConnectTimeout=10",
        f"{SSH_USER}@{host}",
    ]


def remote(host: str, command: str, check: bool = True, quiet: bool = False):
    proc = subprocess.run(
        ssh_base(host) + [command],
        capture_output=quiet, text=True,
    )
    if check and proc.returncode != 0:
        detail = (proc.stderr or "").strip() if quiet else ""
        die(f"remote command failed (exit {proc.returncode}): {command}\n{detail}")
    return proc


def wait_for_ssh(host: str, timeout: int = 300) -> None:
    info(f"waiting for ssh on {host} (up to {timeout}s)…")
    deadline = time.time() + timeout
    while time.time() < deadline:
        proc = subprocess.run(
            ssh_base(host) + ["echo ready"],
            capture_output=True, text=True,
        )
        if proc.returncode == 0:
            ok("ssh is up")
            return
        time.sleep(5)
    die(f"ssh did not become available on {host} within {timeout}s")


# --------------------------------------------------------------------------
# user-data
# --------------------------------------------------------------------------

USER_DATA = f"""#!/bin/bash
set -euxo pipefail

dnf update -y
dnf install -y docker

# t3.small is 2GB. A swap file keeps postgres + node from being OOM-killed
# during a deploy when both the old and new containers are briefly resident.
if [ ! -f /swapfile ]; then
  dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

systemctl enable --now docker
usermod -aG docker {SSH_USER}

# Compose v2 as a CLI plugin (not the deprecated docker-compose binary).
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

mkdir -p {REMOTE_DIR}
chown -R {SSH_USER}:{SSH_USER} {REMOTE_DIR}

touch /var/lib/cloud/kairon-bootstrap-complete
"""


# --------------------------------------------------------------------------
# provision
# --------------------------------------------------------------------------

def ensure_key_pair(ec2) -> None:
    SECRETS_DIR.mkdir(parents=True, exist_ok=True)
    try:
        ec2.describe_key_pairs(KeyNames=[KEY_NAME])
        if KEY_FILE.exists():
            ok(f"key pair {KEY_NAME} exists (private key present locally)")
            return
        die(
            f"AWS has a key pair named {KEY_NAME} but {KEY_FILE} is missing locally.\n"
            "  The private key cannot be re-downloaded. Either restore that file, or\n"
            f"  delete the AWS key pair and re-run provision:\n"
            f"    aws ec2 delete-key-pair --key-name {KEY_NAME} --region {REGION}"
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "InvalidKeyPair.NotFound":
            raise

    resp = ec2.create_key_pair(
        KeyName=KEY_NAME,
        TagSpecifications=[{"ResourceType": "key-pair", "Tags": tags("key")}],
    )
    KEY_FILE.write_text(resp["KeyMaterial"])
    KEY_FILE.chmod(stat.S_IRUSR | stat.S_IWUSR)  # 0600, or ssh refuses it
    ok(f"created key pair {KEY_NAME} → {KEY_FILE}")


def default_vpc_id(ec2) -> str:
    vpcs = ec2.describe_vpcs(Filters=[{"Name": "isDefault", "Values": ["true"]}])["Vpcs"]
    if not vpcs:
        die("no default VPC in this region — create one in the AWS console, then re-run.")
    return vpcs[0]["VpcId"]


def ensure_security_group(ec2, ssh_cidr: str) -> str:
    vpc_id = default_vpc_id(ec2)
    groups = ec2.describe_security_groups(
        Filters=[
            {"Name": "group-name", "Values": [SG_NAME]},
            {"Name": "vpc-id", "Values": [vpc_id]},
        ]
    )["SecurityGroups"]

    if groups:
        sg_id = groups[0]["GroupId"]
        ok(f"security group {SG_NAME} exists ({sg_id})")
    else:
        sg_id = ec2.create_security_group(
            GroupName=SG_NAME,
            Description="KAIRON single-instance deployment",
            VpcId=vpc_id,
            TagSpecifications=[{"ResourceType": "security-group", "Tags": tags("sg")}],
        )["GroupId"]
        ok(f"created security group {SG_NAME} ({sg_id})")

    # AWS rejects rule descriptions containing characters outside
    # [a-zA-Z0-9. _-:/()#,@[]+=&;{}!$*] — no em-dashes here.
    _authorize(ec2, sg_id, 80, "0.0.0.0/0", "HTTP - public app traffic")
    _authorize(ec2, sg_id, 22, ssh_cidr, "SSH - operator")
    return sg_id


def _authorize(ec2, sg_id: str, port: int, cidr: str, description: str) -> None:
    try:
        ec2.authorize_security_group_ingress(
            GroupId=sg_id,
            IpPermissions=[{
                "IpProtocol": "tcp",
                "FromPort": port,
                "ToPort": port,
                "IpRanges": [{"CidrIp": cidr, "Description": description}],
            }],
        )
        ok(f"opened port {port} to {cidr}")
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "InvalidPermission.Duplicate":
            info(f"port {port} already open to {cidr}")
        else:
            raise


def latest_ami(ssm) -> str:
    return ssm.get_parameter(Name=AMI_SSM_PARAM)["Parameter"]["Value"]


def find_running_instance(ec2) -> dict | None:
    reservations = ec2.describe_instances(
        Filters=[
            {"Name": "tag:Project", "Values": [PROJECT]},
            {"Name": "instance-state-name", "Values": ["pending", "running", "stopping", "stopped"]},
        ]
    )["Reservations"]
    for res in reservations:
        for inst in res["Instances"]:
            return inst
    return None


def ensure_instance(ec2, ssm, sg_id: str) -> dict:
    existing = find_running_instance(ec2)
    if existing:
        ok(f"instance {existing['InstanceId']} already exists ({existing['State']['Name']})")
        return existing

    ami = latest_ami(ssm)
    info(f"launching {INSTANCE_TYPE} from {ami}…")
    inst = ec2.run_instances(
        ImageId=ami,
        InstanceType=INSTANCE_TYPE,
        KeyName=KEY_NAME,
        SecurityGroupIds=[sg_id],
        MinCount=1,
        MaxCount=1,
        UserData=USER_DATA,
        BlockDeviceMappings=[{
            "DeviceName": "/dev/xvda",
            "Ebs": {"VolumeSize": 20, "VolumeType": "gp3", "DeleteOnTermination": True},
        }],
        TagSpecifications=[
            {"ResourceType": "instance", "Tags": tags("api")},
            {"ResourceType": "volume", "Tags": tags("root")},
        ],
        MetadataOptions={"HttpTokens": "required"},  # IMDSv2 only
    )["Instances"][0]

    instance_id = inst["InstanceId"]
    ok(f"launched {instance_id}")
    info("waiting for instance to reach 'running'…")
    ec2.get_waiter("instance_running").wait(InstanceIds=[instance_id])
    return ec2.describe_instances(InstanceIds=[instance_id])["Reservations"][0]["Instances"][0]


def ensure_elastic_ip(ec2, instance_id: str) -> str:
    addrs = ec2.describe_addresses(
        Filters=[{"Name": "tag:Project", "Values": [PROJECT]}]
    )["Addresses"]

    if addrs:
        addr = addrs[0]
        ok(f"elastic IP {addr['PublicIp']} exists")
    else:
        alloc = ec2.allocate_address(
            Domain="vpc",
            TagSpecifications=[{"ResourceType": "elastic-ip", "Tags": tags("eip")}],
        )
        addr = {"PublicIp": alloc["PublicIp"], "AllocationId": alloc["AllocationId"]}
        ok(f"allocated elastic IP {addr['PublicIp']}")

    if addr.get("InstanceId") != instance_id:
        ec2.associate_address(AllocationId=addr["AllocationId"], InstanceId=instance_id)
        ok(f"associated {addr['PublicIp']} → {instance_id}")

    return addr["PublicIp"]


def cmd_provision(args) -> None:
    account, arn = require_credentials()
    step(f"AWS account {account} · region {REGION}")
    info(f"identity: {arn}")

    ssh_cidr = args.ssh_cidr or f"{my_public_ip()}/32"

    sess = session()
    ec2, ssm = sess.client("ec2"), sess.client("ssm")

    step("Key pair")
    ensure_key_pair(ec2)

    step("Security group")
    sg_id = ensure_security_group(ec2, ssh_cidr)

    step("EC2 instance")
    inst = ensure_instance(ec2, ssm, sg_id)

    step("Elastic IP")
    host = ensure_elastic_ip(ec2, inst["InstanceId"])

    state = load_state()
    state.update({
        "region": REGION,
        "account_id": account,
        "instance_id": inst["InstanceId"],
        "instance_type": INSTANCE_TYPE,
        "security_group_id": sg_id,
        "host": host,
        "key_file": str(KEY_FILE),
        "ssh_cidr": ssh_cidr,
    })
    # Generated once and reused — regenerating on every provision would
    # invalidate every issued JWT and orphan the existing postgres volume.
    state.setdefault("jwt_secret", secrets.token_urlsafe(48))
    state.setdefault("postgres_password", secrets.token_urlsafe(24))
    save_state(state)

    step("Bootstrap")
    wait_for_ssh(host)
    info("waiting for docker + compose install to finish…")
    for _ in range(60):
        probe = remote(host, "test -f /var/lib/cloud/kairon-bootstrap-complete && echo done",
                       check=False, quiet=True)
        if "done" in probe.stdout:
            ok("instance bootstrap complete")
            break
        time.sleep(10)
    else:
        warn("bootstrap marker not found yet — check `kairon.py logs --cloud-init`")

    write_remote_env(host, state)

    print()
    ok(f"provisioned. app will be at  http://{host}")
    info("next:  ./kairon.py github-oidc  &&  ./kairon.py secrets")


def write_remote_env(host: str, state: dict) -> None:
    """Writes /opt/kairon/.env — the values docker-compose.prod.yml interpolates."""
    slug = repo_slug().lower()
    env = "\n".join([
        f"POSTGRES_PASSWORD={state['postgres_password']}",
        f"JWT_SECRET={state['jwt_secret']}",
        f"API_IMAGE=ghcr.io/{slug}-api:latest",
        f"WEB_IMAGE=ghcr.io/{slug}-web:latest",
    ]) + "\n"

    remote(host, f"mkdir -p {REMOTE_DIR}")
    subprocess.run(
        ssh_base(host) + [f"cat > {REMOTE_DIR}/.env && chmod 600 {REMOTE_DIR}/.env"],
        input=env, text=True, check=True,
    )
    ok(f"wrote {REMOTE_DIR}/.env")

    compose = (REPO_ROOT / "docker-compose.prod.yml").read_text()
    subprocess.run(
        ssh_base(host) + [f"cat > {REMOTE_DIR}/docker-compose.yml"],
        input=compose, text=True, check=True,
    )
    ok(f"wrote {REMOTE_DIR}/docker-compose.yml")


# --------------------------------------------------------------------------
# github oidc — lets Actions assume a role instead of holding static AWS keys
# --------------------------------------------------------------------------

def cmd_github_oidc(args) -> None:
    account, _ = require_credentials()
    slug = repo_slug()
    sess = session()
    iam = sess.client("iam")

    step("GitHub OIDC provider")
    provider_arn = f"arn:aws:iam::{account}:oidc-provider/token.actions.githubusercontent.com"
    try:
        iam.get_open_id_connect_provider(OpenIDConnectProviderArn=provider_arn)
        ok("OIDC provider already exists")
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "NoSuchEntity":
            raise
        iam.create_open_id_connect_provider(
            Url=GITHUB_OIDC_URL,
            ClientIDList=[GITHUB_OIDC_AUDIENCE],
            # Thumbprint is no longer verified by AWS for this provider, but the
            # API still requires the field.
            ThumbprintList=["ffffffffffffffffffffffffffffffffffffffff"],
            Tags=tags("oidc"),
        )
        ok("created OIDC provider")

    step("IAM role")
    trust = {
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Principal": {"Federated": provider_arn},
            "Action": "sts:AssumeRoleWithWebIdentity",
            "Condition": {
                "StringEquals": {
                    "token.actions.githubusercontent.com:aud": GITHUB_OIDC_AUDIENCE
                },
                # Scoped to THIS repo — no other repo can assume this role.
                "StringLike": {
                    "token.actions.githubusercontent.com:sub": f"repo:{slug}:*"
                },
            },
        }],
    }
    # The workflow only ever needs to punch its own runner IP into the SSH
    # security group and take it back out again. Nothing else.
    policy = {
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Action": [
                "ec2:AuthorizeSecurityGroupIngress",
                "ec2:RevokeSecurityGroupIngress",
                "ec2:DescribeSecurityGroups",
            ],
            "Resource": "*",
        }],
    }

    try:
        iam.get_role(RoleName=ROLE_NAME)
        iam.update_assume_role_policy(RoleName=ROLE_NAME, PolicyDocument=json.dumps(trust))
        ok(f"role {ROLE_NAME} exists (trust policy refreshed)")
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "NoSuchEntity":
            raise
        iam.create_role(
            RoleName=ROLE_NAME,
            AssumeRolePolicyDocument=json.dumps(trust),
            Description="Lets GitHub Actions open the KAIRON SSH group during deploys",
            Tags=tags("role"),
        )
        ok(f"created role {ROLE_NAME}")

    iam.put_role_policy(
        RoleName=ROLE_NAME,
        PolicyName="kairon-deploy-sg",
        PolicyDocument=json.dumps(policy),
    )
    ok("attached inline policy kairon-deploy-sg")

    role_arn = f"arn:aws:iam::{account}:role/{ROLE_NAME}"
    state = load_state()
    state["role_arn"] = role_arn
    save_state(state)
    print()
    ok(f"role ARN: {role_arn}")


# --------------------------------------------------------------------------
# github secrets
# --------------------------------------------------------------------------

def cmd_secrets(args) -> None:
    state = load_state()
    if not state.get("host"):
        die("no provisioned instance found — run `./kairon.py provision` first.")
    if not shutil.which("gh"):
        die("the GitHub CLI (gh) is required for this command.")

    slug = repo_slug()
    entries = {
        "EC2_HOST": state["host"],
        "EC2_SSH_KEY": KEY_FILE.read_text(),
        "AWS_ROLE_ARN": state.get("role_arn", ""),
        "AWS_REGION": REGION,
        "AWS_SECURITY_GROUP_ID": state["security_group_id"],
    }
    if not entries["AWS_ROLE_ARN"]:
        die("no role ARN in state — run `./kairon.py github-oidc` first.")

    step(f"Pushing secrets to {slug}")
    for name, value in entries.items():
        proc = subprocess.run(
            ["gh", "secret", "set", name, "--repo", slug, "--body", value],
            capture_output=True, text=True,
        )
        if proc.returncode != 0:
            die(f"failed to set {name}: {proc.stderr.strip()}")
        ok(f"set {name}")

    print()
    ok("secrets are in place — pushes to main will now deploy.")


# --------------------------------------------------------------------------
# operations
# --------------------------------------------------------------------------

def require_host() -> tuple[str, dict]:
    state = load_state()
    host = state.get("host")
    if not host:
        die("no provisioned instance found — run `./kairon.py provision` first.")
    return host, state


def compose(cmd: str) -> str:
    return f"cd {REMOTE_DIR} && docker compose {cmd}"


def cmd_deploy(args) -> None:
    host, state = require_host()
    write_remote_env(host, state)
    step("Pulling images and restarting")
    remote(host, compose("pull"))
    remote(host, compose("up -d --remove-orphans"))
    step("Applying migrations")
    remote(host, compose("run --rm api npx prisma migrate deploy"))
    ok(f"deployed → http://{host}")


def cmd_migrate(args) -> None:
    host, _ = require_host()
    remote(host, compose("run --rm api npx prisma migrate deploy"))
    ok("migrations applied")


def cmd_seed(args) -> None:
    host, _ = require_host()
    if not args.yes:
        warn("`npm run seed` REBUILDS demo data: it truncates every table first.")
        if input("  Type 'seed' to continue: ").strip() != "seed":
            sys.exit("aborted")
    remote(host, compose("run --rm api npm run seed"))
    ok("demo data reseeded")


def cmd_logs(args) -> None:
    host, _ = require_host()
    if args.cloud_init:
        remote(host, "sudo tail -n 200 /var/log/cloud-init-output.log")
        return
    target = f" {args.service}" if args.service else ""
    remote(host, compose(f"logs --tail 200 --no-color{target}"), check=False)


def cmd_ssh(args) -> None:
    host, _ = require_host()
    os.execvp("ssh", ssh_base(host))


def cmd_status(args) -> None:
    state = load_state()
    if not state:
        die("nothing provisioned yet — run `./kairon.py provision`.")

    account, _ = require_credentials()
    ec2 = session().client("ec2")
    inst = find_running_instance(ec2)

    step("AWS")
    info(f"account        {account}")
    info(f"region         {REGION}")
    info(f"instance       {state.get('instance_id')} "
         f"({inst['State']['Name'] if inst else 'NOT FOUND'})")
    info(f"type           {state.get('instance_type')}")
    info(f"host           {state.get('host')}")
    info(f"role arn       {state.get('role_arn', '— not set up —')}")

    step("Application")
    host = state.get("host")
    try:
        with urllib.request.urlopen(f"http://{host}/healthz", timeout=8) as r:
            ok(f"web  http://{host}  →  {r.status} {r.read().decode().strip()}")
    except Exception as exc:  # noqa: BLE001
        warn(f"web  http://{host}  →  unreachable ({exc})")

    proc = remote(host, compose("ps --format '{{.Service}} {{.State}}'"),
                  check=False, quiet=True)
    if proc.returncode == 0 and proc.stdout.strip():
        for line in proc.stdout.strip().splitlines():
            info(line)
    else:
        warn("no containers reported (not deployed yet?)")


# --------------------------------------------------------------------------
# destroy
# --------------------------------------------------------------------------

def cmd_destroy(args) -> None:
    state = load_state()
    require_credentials()
    sess = session()
    ec2, iam = sess.client("ec2"), sess.client("iam")

    warn("This permanently deletes the instance, its EBS volume (ALL seeded data),")
    warn("the elastic IP, the security group and the key pair.")
    if not args.yes and input("  Type 'destroy' to continue: ").strip() != "destroy":
        sys.exit("aborted")

    step("Instance")
    inst = find_running_instance(ec2)
    if inst:
        instance_id = inst["InstanceId"]
        ec2.terminate_instances(InstanceIds=[instance_id])
        info(f"terminating {instance_id}…")
        ec2.get_waiter("instance_terminated").wait(InstanceIds=[instance_id])
        ok(f"terminated {instance_id}")
    else:
        info("no instance found")

    step("Elastic IP")
    for addr in ec2.describe_addresses(
        Filters=[{"Name": "tag:Project", "Values": [PROJECT]}]
    )["Addresses"]:
        if addr.get("AssociationId"):
            ec2.disassociate_address(AssociationId=addr["AssociationId"])
        ec2.release_address(AllocationId=addr["AllocationId"])
        ok(f"released {addr['PublicIp']}")

    step("Security group")
    for group in ec2.describe_security_groups(
        Filters=[{"Name": "group-name", "Values": [SG_NAME]}]
    )["SecurityGroups"]:
        # The ENI holding this group can linger briefly after termination.
        for attempt in range(12):
            try:
                ec2.delete_security_group(GroupId=group["GroupId"])
                ok(f"deleted {group['GroupId']}")
                break
            except ClientError as exc:
                if exc.response["Error"]["Code"] != "DependencyViolation":
                    raise
                time.sleep(10)
        else:
            warn(f"could not delete {group['GroupId']} — delete it manually later")

    step("Key pair")
    try:
        ec2.delete_key_pair(KeyName=KEY_NAME)
        ok(f"deleted {KEY_NAME}")
        KEY_FILE.unlink(missing_ok=True)
    except ClientError as exc:
        warn(f"key pair: {exc}")

    if args.include_iam:
        step("IAM role")
        try:
            iam.delete_role_policy(RoleName=ROLE_NAME, PolicyName="kairon-deploy-sg")
            iam.delete_role(RoleName=ROLE_NAME)
            ok(f"deleted role {ROLE_NAME}")
        except ClientError as exc:
            warn(f"role: {exc}")

    STATE_FILE.unlink(missing_ok=True)
    print()
    ok("all resources removed — billing for this stack has stopped.")


# --------------------------------------------------------------------------
# cli
# --------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        prog="kairon.py",
        description="Provision and manage the KAIRON AWS deployment.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("provision", help="create all AWS resources (idempotent)")
    p.add_argument("--ssh-cidr", help="CIDR allowed to SSH (default: your current IP/32)")
    p.set_defaults(func=cmd_provision)

    sub.add_parser("github-oidc", help="create the OIDC provider + IAM role for Actions") \
        .set_defaults(func=cmd_github_oidc)

    sub.add_parser("secrets", help="push deploy secrets to the GitHub repo") \
        .set_defaults(func=cmd_secrets)

    sub.add_parser("deploy", help="pull latest images, restart, migrate") \
        .set_defaults(func=cmd_deploy)

    sub.add_parser("migrate", help="run prisma migrate deploy on the instance") \
        .set_defaults(func=cmd_migrate)

    p = sub.add_parser("seed", help="DESTRUCTIVE: rebuild demo data on the instance")
    p.add_argument("--yes", action="store_true", help="skip the confirmation prompt")
    p.set_defaults(func=cmd_seed)

    p = sub.add_parser("logs", help="tail container logs")
    p.add_argument("service", nargs="?", help="api | web | postgres (default: all)")
    p.add_argument("--cloud-init", action="store_true", help="show instance bootstrap log")
    p.set_defaults(func=cmd_logs)

    sub.add_parser("ssh", help="interactive shell on the instance").set_defaults(func=cmd_ssh)
    sub.add_parser("status", help="show what exists and whether it is healthy") \
        .set_defaults(func=cmd_status)

    p = sub.add_parser("destroy", help="remove every AWS resource this created")
    p.add_argument("--yes", action="store_true", help="skip the confirmation prompt")
    p.add_argument("--include-iam", action="store_true", help="also delete the GitHub OIDC role")
    p.set_defaults(func=cmd_destroy)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
