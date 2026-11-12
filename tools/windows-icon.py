"""Apply the shared ICO to the staged executable; never edit the installed runtime."""
import ctypes,struct,sys
from pathlib import Path
exe,ico=map(Path,sys.argv[1:]);data=ico.read_bytes();reserved,kind,count=struct.unpack_from('<HHH',data);assert reserved==0 and kind==1
kernel=ctypes.WinDLL('kernel32',use_last_error=True)
kernel.BeginUpdateResourceW.argtypes=[ctypes.c_wchar_p,ctypes.c_bool];kernel.BeginUpdateResourceW.restype=ctypes.c_void_p
kernel.UpdateResourceW.argtypes=[ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_ushort,ctypes.c_void_p,ctypes.c_uint];kernel.UpdateResourceW.restype=ctypes.c_bool
kernel.EndUpdateResourceW.argtypes=[ctypes.c_void_p,ctypes.c_bool];kernel.EndUpdateResourceW.restype=ctypes.c_bool
handle=kernel.BeginUpdateResourceW(str(exe),False)
if not handle:raise ctypes.WinError(ctypes.get_last_error())
try:
 group=struct.pack('<HHH',0,1,count)
 for index in range(count):
  width,height,colors,reserved,planes,bits,size,offset=struct.unpack_from('<BBBBHHII',data,6+16*index);icon=data[offset:offset+size];resource=100+index
  buffer=ctypes.create_string_buffer(icon)
  if not kernel.UpdateResourceW(handle,3,resource,1033,buffer,len(icon)):raise ctypes.WinError(ctypes.get_last_error())
  group+=struct.pack('<BBBBHHIH',width,height,colors,reserved,planes,bits,size,resource)
 buffer=ctypes.create_string_buffer(group)
 if not kernel.UpdateResourceW(handle,14,1,1033,buffer,len(group)):raise ctypes.WinError(ctypes.get_last_error())
 if not kernel.EndUpdateResourceW(handle,False):raise ctypes.WinError(ctypes.get_last_error())
 handle=None
finally:
 if handle:kernel.EndUpdateResourceW(handle,True)
