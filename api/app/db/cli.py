import argparse
import asyncio
import sys
from dataclasses import asdict

from app.db.migrate import upgrade_database
from app.db.seed import SeedError, load_seed_pack, seed_database
from app.db.session import Database
from app.settings import ConfigurationError, load_settings, resolve_path


async def run(args: argparse.Namespace) -> None:
    settings = load_settings()
    # Validate the entire pack and demo permission before touching the database.
    pack = None
    if args.command == "seed":
        if settings.app_env != "demo":
            raise SeedError("Synthetic seed and reset require APP_ENV=demo")
        pack = load_seed_pack(resolve_path(args.pack) if args.pack else settings.mock_pack_dir)
    settings.prepare_directories()
    database = Database(settings)
    try:
        await upgrade_database(database)
        if args.command == "seed":
            summary = await seed_database(database, settings, pack, reset=args.reset)
            print(asdict(summary))
        else:
            print("Database migrated to head")
    finally:
        await database.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Alodi local database commands")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("upgrade", help="Apply versioned migrations without deleting data")
    seed = commands.add_parser("seed", help="Seed an empty demo DB; existing seeds are retained")
    seed.add_argument("--pack", help="Mock pack path, relative to repository root")
    seed.add_argument(
        "--reset", action="store_true", help="Explicitly replace demo data; stop API first"
    )
    try:
        asyncio.run(run(parser.parse_args()))
    except (ConfigurationError, SeedError) as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(2) from None


if __name__ == "__main__":
    main()
