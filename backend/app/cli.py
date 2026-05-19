from __future__ import annotations

import argparse
import asyncio
import sys


async def _create_admin(email: str, password: str) -> None:
    from app.core.security import hash_password
    from app.db.session import get_engine, get_session_factory
    from app.repositories import admin_users as admin_repo

    get_engine()
    factory = get_session_factory()
    async with factory() as session:
        existing = await admin_repo.get_by_email(session, email)
        if existing:
            print(f"Error: admin '{email}' already exists.")
            sys.exit(1)
        admin = await admin_repo.create(
            session,
            email=email,
            password_hash=hash_password(password),
        )
        await session.commit()
        print(f"Admin created: {admin.email}  (id={admin.id})")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("create-admin", help="Bootstrap the first admin user")
    p.add_argument("--email", required=True)
    p.add_argument("--password", required=True)

    args = parser.parse_args()

    if args.command == "create-admin":
        asyncio.run(_create_admin(args.email, args.password))


if __name__ == "__main__":
    main()
