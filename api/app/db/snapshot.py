"""Fast demo restart: restore a fully prepared database under a new generation.

Preparing a generation walks thousands of orders through the morning workflow. That result is
deterministic, so it is captured once beside the database and copied back on later resets.
Delete the snapshot file after changing seed or morning-workflow code.
"""

import asyncio
import os
import sqlite3
from pathlib import Path

from sqlalchemy.engine import make_url

from app.settings import Settings


def snapshot_path(settings: Settings) -> Path | None:
    name = make_url(settings.database_url).database
    if not name or name == ":memory:":
        return None
    path = Path(name)
    return path.with_name(f"{path.stem}.prepared{path.suffix}")


def _save(database: Path, target: Path) -> None:
    partial = target.with_name(f"{target.name}.partial")
    partial.unlink(missing_ok=True)
    connection = sqlite3.connect(database, timeout=30)
    try:
        connection.execute("VACUUM INTO ?", (str(partial),))
    finally:
        connection.close()
    os.replace(partial, target)


def _quote(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def _restore(database: Path, snapshot: Path, generation: str) -> bool:
    connection = sqlite3.connect(database, timeout=30, isolation_level=None)
    try:
        # The whole set is replaced atomically, so ordering between related tables is irrelevant.
        connection.execute("PRAGMA foreign_keys=OFF")
        connection.execute("ATTACH DATABASE ? AS prepared", (str(snapshot),))
        connection.execute("BEGIN IMMEDIATE")
        try:
            versions = [
                connection.execute(f"SELECT version_num FROM {schema}.alembic_version").fetchall()
                for schema in ("main", "prepared")
            ]
            if versions[0] != versions[1]:
                connection.execute("ROLLBACK")
                return False
            tables = [
                row[0]
                for row in connection.execute(
                    "SELECT name FROM main.sqlite_master WHERE type = 'table' "
                    "AND name NOT LIKE 'sqlite_%' AND name != 'alembic_version'"
                )
            ]
            for table in tables:
                connection.execute(f"DELETE FROM main.{_quote(table)}")
            for table in tables:
                columns = [
                    row[1] for row in connection.execute(f"PRAGMA main.table_info({_quote(table)})")
                ]
                names = ", ".join(_quote(column) for column in columns)
                values = ", ".join(
                    "?" if column == "generation_id" else _quote(column) for column in columns
                )
                parameters = (generation,) if "generation_id" in columns else ()
                connection.execute(
                    f"INSERT INTO main.{_quote(table)} ({names}) "
                    f"SELECT {values} FROM prepared.{_quote(table)}",
                    parameters,
                )
            connection.execute("COMMIT")
            return True
        except BaseException:
            if connection.in_transaction:
                connection.execute("ROLLBACK")
            raise
    finally:
        connection.close()


async def save_snapshot(settings: Settings) -> None:
    """A failed capture only means the next reset takes the full path."""
    target = snapshot_path(settings)
    if target:
        try:
            await asyncio.to_thread(_save, Path(make_url(settings.database_url).database), target)
        except (OSError, sqlite3.Error):
            target.unlink(missing_ok=True)


async def restore_snapshot(settings: Settings, generation: str) -> bool:
    """Returns False, with the database untouched, when no usable snapshot exists."""
    target = snapshot_path(settings)
    if not target or not target.exists():
        return False
    try:
        return await asyncio.to_thread(
            _restore, Path(make_url(settings.database_url).database), target, generation
        )
    except sqlite3.DatabaseError:
        target.unlink(missing_ok=True)
        return False
