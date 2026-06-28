import os
import json

def initialize_workspace():
    # Define directories
    directories = ['app', 'data', 'frontend']
    for directory in directories:
        if not os.path.exists(directory):
            os.makedirs(directory)
            print(f"Created directory: {directory}")
        else:
            print(f"Directory already exists: {directory}")

    # Define baseline progress tracking
    progress_file = 'build_progress.json'
    if not os.path.exists(progress_file):
        initial_progress = {
            "Phase 1": {
                "status": "pending",
                "timestamp": None,
                "description": "Database and Workspace Setup"
            }
        }
        with open(progress_file, 'w') as f:
            json.dump(initial_progress, f, indent=4)
        print(f"Initialized {progress_file}")
    else:
        print(f"{progress_file} already exists")

if __name__ == "__main__":
    initialize_workspace()
