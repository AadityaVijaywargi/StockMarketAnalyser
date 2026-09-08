import sys
import os
import glob

def search_codebase():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    print("Searching python files for trade level generation...")

    for py_file in glob.glob(os.path.join(root_dir, "**", "*.py"), recursive=True):
        if "venv" in py_file or ".git" in py_file:
            continue
        try:
            with open(py_file, "r", encoding="utf-8") as f:
                content = f.read()
                if "target_price" in content or "stop_loss" in content or "Playbook" in content or "entry" in content.lower():
                    print(f"  Found reference in: {os.path.relpath(py_file, root_dir)}")
        except Exception as e:
            pass

if __name__ == "__main__":
    search_codebase()
