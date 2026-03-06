"""Rive MCP client for building Shipmate character state machine."""
import requests
import json
import subprocess
import threading
import time
import sys

BASE = "http://localhost:9791"

class RiveMCP:
    def __init__(self):
        self.session_id = None
        self.results = {}
        self._next_id = 0
        self._listener = None

    def connect(self):
        """Establish SSE connection and get session ID."""
        # Kill any stale curl connections first
        subprocess.run(["pkill", "-f", "curl.*9791"], capture_output=True)
        time.sleep(0.5)

        # Get session ID via curl with Accept header
        proc = subprocess.run(
            ["curl", "-s", "-N", "-H", "Accept: text/event-stream",
             f"{BASE}/sse", "--max-time", "3"],
            capture_output=True, text=True
        )
        for line in proc.stdout.split("\n"):
            if line.startswith("data:") and "sessionId=" in line:
                self.session_id = line.strip().split("data:")[1].strip()
                break

        if not self.session_id:
            raise Exception("Could not get session ID from Rive MCP")

        self.msg_url = f"{BASE}{self.session_id}"
        print(f"Connected: {self.msg_url}")

        # Start background SSE listener
        self._start_listener()
        time.sleep(0.5)

        # Initialize MCP
        self._call("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "claude-code", "version": "1.0"}
        }, method_override="initialize")
        time.sleep(1)
        return self

    def _start_listener(self):
        def listen():
            try:
                resp = requests.get(f"{BASE}/sse",
                    headers={"Accept": "text/event-stream"},
                    stream=True, timeout=300)
                event_type = None
                for line in resp.iter_lines(decode_unicode=True):
                    if line is None:
                        continue
                    if line.startswith("event:"):
                        event_type = line[6:].strip()
                    elif line.startswith("data:") and event_type == "message":
                        try:
                            data = json.loads(line[5:].strip())
                            if "id" in data:
                                self.results[data["id"]] = data
                        except:
                            pass
                        event_type = None
            except:
                pass

        self._listener = threading.Thread(target=listen, daemon=True)
        self._listener.start()

    def _call(self, method, params, method_override=None):
        self._next_id += 1
        msg_id = self._next_id
        payload = {
            "jsonrpc": "2.0",
            "id": msg_id,
            "method": method_override or "tools/call",
        }
        if method_override:
            payload["params"] = params
        else:
            payload["params"] = {"name": method, "arguments": params}

        r = requests.post(self.msg_url, json=payload)
        if r.status_code != 200 and r.status_code != 202:
            print(f"HTTP {r.status_code}: {r.text[:200]}")

        # Wait for response
        for _ in range(20):
            if msg_id in self.results:
                return self.results[msg_id]
            time.sleep(0.5)

        print(f"Timeout waiting for response to {method}")
        return None

    def tool(self, name, args=None):
        """Call a Rive MCP tool."""
        result = self._call(name, args or {})
        if result:
            return result.get("result", result)
        return None

    def flush(self):
        """Call promptEnded to flush changes."""
        return self.tool("promptEnded")


def build_shipmate():
    """Build the Shipmate state machine."""
    r = RiveMCP()
    r.connect()

    # Check current state
    print("\n--- Current state ---")
    sm = r.tool("listStateMachines")
    print(f"State machines: {json.dumps(sm, indent=2)[:500]}")

    anims = r.tool("listLinearAnimations")
    print(f"Animations: {json.dumps(anims, indent=2)[:500]}")

    if "--create" not in sys.argv:
        print("\nRun with --create to build the state machine")
        return

    # Create linear animations for each state
    print("\n--- Creating animations ---")
    animations = [
        "idle", "listening", "speaking", "thinking",
        "happy", "confused", "celebrating", "focused",
        "sleeping", "error", "notification", "loading"
    ]

    r.tool("createLinearAnimations", {
        "animations": [{"name": name, "fps": 60, "duration": 60} for name in animations]
    })
    print(f"Created {len(animations)} animations")

    # Create the Companion state machine
    print("\n--- Creating state machine ---")
    r.tool("createStateMachine", {
        "name": "Companion",
        "layers": [{
            "name": "Main",
            "states": [
                {"name": "Idle", "animationName": "idle", "x": 300, "y": 200},
                {"name": "Listening", "animationName": "listening", "x": 600, "y": 100},
                {"name": "Speaking", "animationName": "speaking", "x": 600, "y": 300},
                {"name": "Thinking", "animationName": "thinking", "x": 600, "y": 500},
                {"name": "Happy", "animationName": "happy", "x": 900, "y": 100},
                {"name": "Confused", "animationName": "confused", "x": 900, "y": 200},
                {"name": "Celebrating", "animationName": "celebrating", "x": 900, "y": 300},
                {"name": "Focused", "animationName": "focused", "x": 900, "y": 400},
                {"name": "Sleeping", "animationName": "sleeping", "x": 900, "y": 500},
                {"name": "Error", "animationName": "error", "x": 1200, "y": 100},
                {"name": "Notification", "animationName": "notification", "x": 1200, "y": 300},
                {"name": "Loading", "animationName": "loading", "x": 1200, "y": 500},
            ]
        }]
    })
    print("Created Companion state machine")

    r.flush()
    print("\n--- Done! Changes flushed to Rive ---")


if __name__ == "__main__":
    build_shipmate()
