"""Publikuje wersję produkcyjną BIFOR na gałęzi „produkcja” w GitHubie.

Hosting OVH (katalog ./bifor na yzudqhv.cluster100) pobiera pliki z tej gałęzi.
Skrypt buduje dist/ (tools/build-prod.py) i dokłada na gałąź „produkcja” jeden
commit z gotowymi plikami strony. Gałąź nie zawiera źródeł i ma ciągłą historię
(bez wymuszonego nadpisywania), żeby serwer mógł ją zwyczajnie pobrać.

Po wypchnięciu trzeba jeszcze uruchomić wdrożenie przy domenie w panelu OVH
(Hosting -> Moje strony -> bifor.pl -> menu akcji -> wdrożenie Git).

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


def writable(fn, path, exc):
    # .git ma pliki tylko do odczytu — bez tego Windows nie usunie katalogu tymczasowego
    Path(path).chmod(0o700)
    fn(path)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    dirty = git("status", "--porcelain", cwd=ROOT)
    if dirty:
        sys.exit("Są niezapisane zmiany — najpierw commit, żeby produkcja odpowiadała historii:\n" + dirty)

    subprocess.run([sys.executable, str(ROOT / "tools" / "build-prod.py")], check=True)
    remote = git("remote", "get-url", "origin", cwd=ROOT)
    source = git("rev-parse", "--short", "HEAD", cwd=ROOT)

    tmp = Path(tempfile.mkdtemp(prefix="bifor-prod-"))
    work = tmp / "site"
    try:
        # bierzemy obecny stan gałęzi i podmieniamy w nim wszystkie pliki
        subprocess.run(["git", "clone", "-q", "--depth", "1", "--branch", BRANCH, remote, str(work)], check=True)
        git("config", "core.autocrlf", "false", cwd=work)
        for child in work.iterdir():
            if child.name == ".git":
                continue
            shutil.rmtree(child, onexc=writable) if child.is_dir() else child.unlink()
        shutil.copytree(ROOT / "dist", work, dirs_exist_ok=True)
        git("add", "-A", cwd=work)
        if not git("status", "--porcelain", cwd=work):
            print(f"Gałąź „{BRANCH}” już odpowiada commitowi {source} — nic do wypchnięcia.")
            return
        git("-c", "user.name=Piotr Olek", "-c", "user.email=biuro@olekcodetech.pl",
            "commit", "-q", "-m", f"bifor.pl: wersja produkcyjna z commita {source}", cwd=work)
        subprocess.run(["git", "push", "origin", BRANCH], cwd=work, check=True)
    finally:
        shutil.rmtree(tmp, onexc=writable)
    print(f"Gałąź „{BRANCH}” = commit {source}. Teraz wdrożenie Git w panelu OVH.")


if __name__ == "__main__":
    main()
