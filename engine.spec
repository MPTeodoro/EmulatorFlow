# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for the EmulatorFlow Python engine.
# Run from the project root:
#   pyinstaller engine.spec
#
# Expects platform-tools/ (ADB) to exist in the project root.
# In CI this is downloaded automatically; locally run:
#   Invoke-WebRequest https://dl.google.com/android/repository/platform-tools-latest-windows.zip -OutFile pt.zip
#   Expand-Archive pt.zip .

import os, sys

block_cipher = None

# ADB binaries to bundle (Windows).
# On non-Windows CI just omit them — the engine will fall back to system adb.
_adb_binaries = []
_pt = os.path.join(os.getcwd(), 'platform-tools')
for _name in ('adb.exe', 'AdbWinApi.dll', 'AdbWinUsbApi.dll'):
    _p = os.path.join(_pt, _name)
    if os.path.exists(_p):
        _adb_binaries.append((_p, '.'))

a = Analysis(
    [os.path.join('engine', 'main.py')],
    pathex=[os.path.join(os.getcwd(), 'engine')],
    binaries=_adb_binaries,
    datas=[],
    hiddenimports=[
        # uvicorn internals not auto-discovered
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.loops.asyncio',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.protocols.websockets.websockets_impl',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'anyio',
        'anyio._backends._asyncio',
        'starlette.middleware.cors',
        'email.mime.multipart',
        'email.mime.text',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'scipy', 'pandas'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='python-engine',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,   # headless — no terminal window for end users
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
