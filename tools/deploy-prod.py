"""Publikuje wersję produkcyjną BIFOR na gałęzi „produkcja” w GitHubie.

Hosting OVH (katalog ./bifor na yzudqhv.cluster100) pobiera pliki z tej gałęzi.
Skrypt buduje dist/ (tools/build-prod.py), robi z niego jeden commit i wypycha go
na gałąź „produkcja”. Gałąź zawiera wyłącznie gotowe pliki strony, bez źródeł.

Po wypchnięciu trzeba jeszcze kliknąć „Wdróż” przy domenie w panelu OVH
(Hosting -> Moje strony -> bifor.pl -> Git), chyba że działa webhook.

Użycie: python tools/deploy-prod.py
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BRANCH = "produkcja"


def git(*args, cwd):
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True, encoding="utf-8").stdout.strip()


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    dirty = git("status", "--porcelain", cwd=ROOT)
    if dirty:
        sys.exit("Są niezapisane zmiany — najpierw commit, żeby produkcja odpowiadała historii:\n" + dirty)

    subprocess.run([sys.executable, str(ROOT / "tools" / "build-prod.py")], check=True)
    remote = git("remote", "get-url", "origin", cwd=ROOT)
    source = git("rev-parse", "--short", "HEAD", cwd=ROOT)

    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp) / "site"
        shutil.copytree(ROOT / "dist", work)
        git("init", "-q", "-b", BRANCH, cwd=work)
        git("config", "core.autocrlf", "false", cwd=work)
        git("add", "-A", cwd=work)
        git("-c", "user.name=Piotr Olek", "-c", "user.email=biuro@olekcodetech.pl",
            "commit", "-q", "-m", f"bifor.pl: wersja produkcyjna z commita {source}", cwd=work)
        subprocess.run(["git", "push", "-f", remote, f"{BRANCH}:{BRANCH}"], cwd=work, check=True)
        # .git ma pliki tylko do odczytu — bez tego Windows nie usunie katalogu tymczasowego
        shutil.rmtree(work / ".git", onexc=lambda fn, path, exc: (Path(path).chmod(0o700), fn(path)))
    print(f"Gałąź „{BRANCH}” = commit {source}. Teraz „Wdróż” w panelu OVH.")


if __name__ == "__main__":
    main()
