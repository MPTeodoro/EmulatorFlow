from pydantic import BaseModel
from typing import Optional


class NodeData(BaseModel):
    model_config = {"extra": "allow"}

    label: str = ""
    image_path: str = ""        # path relative to project assets/
    threshold: float = 0.7
    x: int = 0
    y: int = 0
    x1: int = 0
    y1: int = 0
    x2: int = 0
    y2: int = 0
    duration: int = 100         # ms for tap/swipe
    seconds: float = 1.0        # for wait
    iterations: int = 10        # -1 = infinite for loop
    timeout: float = 30.0       # for wait_for_image
    interval: float = 2.0       # polling interval for wait_for_image
    message: str = ""           # for log node


class Node(BaseModel):
    model_config = {"extra": "allow"}

    id: str
    type: str                   # start|match_screen|find_element|wait_for_image|tap|swipe|wait|loop|log
    data: NodeData
    position: dict = {}         # not used in execution but kept for round-trip


class Edge(BaseModel):
    model_config = {"extra": "allow"}

    id: str
    source: str
    target: str
    sourceHandle: str = "out"
    targetHandle: str = "in"


class Workflow(BaseModel):
    id: str = "unsaved"
    name: str = "Untitled"
    nodes: list[Node]
    edges: list[Edge]
    assets_path: str = ""       # absolute path to project's assets/ folder


class ExecuteRequest(BaseModel):
    workflow: Workflow
    device: str                 # e.g. "127.0.0.1:5555"


class ConnectRequest(BaseModel):
    address: str


class ScreenshotRequest(BaseModel):
    device: str


class AdBlockRequest(BaseModel):
    device: str
    enable: bool


class DeviceInfo(BaseModel):
    id: str
    name: str
    status: str                 # connected | connecting | offline
