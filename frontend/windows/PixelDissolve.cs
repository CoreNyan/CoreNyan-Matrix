using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;

// A short-lived, non-activating per-pixel-alpha window. It contains only our
// WebView snapshot, never a desktop capture, and has no renderer or input loop.
internal sealed class PixelDissolve : Form {
    internal const int DurationMs=880;
    const int TargetTiles=640;
    readonly Bitmap source;
    readonly List<Tile> tiles=new List<Tile>();
    readonly Rectangle origin;
    readonly Random random=new Random(Guid.NewGuid().GetHashCode());
    IntPtr memoryDC,dib,previousBitmap,bits;
    Bitmap frame;
    readonly int[] sourcePixels;
    struct Tile { public Rectangle Source;public float Delay,DX,DY,Wave,Size; }
    [StructLayout(LayoutKind.Sequential)] struct Point { public int X,Y;public Point(int x,int y){X=x;Y=y;} }
    [StructLayout(LayoutKind.Sequential)] struct NativeSize { public int Width,Height; }
    [StructLayout(LayoutKind.Sequential,Pack=1)] struct Blend {public byte Op,Flags,Alpha,Format;}
    [StructLayout(LayoutKind.Sequential)] struct BitmapInfo {public uint Size;public int Width,Height;public ushort Planes,BitCount;public uint Compression,ImageSize;public int XPels,YPels;public uint Used,Important;}
    [DllImport("user32.dll",SetLastError=true)] static extern bool UpdateLayeredWindow(IntPtr hwnd,IntPtr target,ref Point point,ref NativeSize size,IntPtr source,ref Point offset,uint key,ref Blend blend,uint flags);
    [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr dc);
    [DllImport("gdi32.dll")] static extern IntPtr CreateDIBSection(IntPtr dc,ref BitmapInfo info,uint usage,out IntPtr pixels,IntPtr section,uint offset);
    [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr dc,IntPtr value);
    [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr value);
    [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr value);
    [DllImport("dwmapi.dll")] static extern int DwmFlush();
    protected override bool ShowWithoutActivation {get{return true;}}
    protected override CreateParams CreateParams {get{var p=base.CreateParams;p.ExStyle|=0x00080000|0x00000020|0x08000000|0x00000080;return p;}}
    static float Ease(float t){return t*t*(3-2*t);}
    float Next(){return (float)random.NextDouble();}
    internal PixelDissolve(Bitmap snapshot,Rectangle window){
        // Memory and per-frame work are bounded even on a 4K/8K or multi-monitor desktop.
        source=snapshot;origin=window;
        sourcePixels=new int[source.Width*source.Height];
        var pixels=source.LockBits(new Rectangle(0,0,source.Width,source.Height),ImageLockMode.ReadOnly,PixelFormat.Format32bppPArgb);
        try{for(int row=0;row<source.Height;row++)Marshal.Copy(IntPtr.Add(pixels.Scan0,row*pixels.Stride),sourcePixels,row*source.Width,source.Width);}finally{source.UnlockBits(pixels);}
        var expanded=window;expanded.Inflate(150,150);expanded=Rectangle.Intersect(expanded,SystemInformation.VirtualScreen);
        if(expanded.Width<=0||expanded.Height<=0)throw new InvalidOperationException("Window outside desktop");
        FormBorderStyle=FormBorderStyle.None;ShowInTaskbar=false;StartPosition=FormStartPosition.Manual;Bounds=expanded;
        // Native layered surfaces use physical pixels. Large windows are sampled
        // into a bounded source but the alpha surface itself stays at native size.
        int tile=Math.Max(24,(int)Math.Ceiling(Math.Sqrt((double)source.Width*source.Height/TargetTiles)));
        for(int y=0;y<source.Height;y+=tile)for(int x=0;x<source.Width;x+=tile){
            float nx=(x+tile*.5f)/source.Width-.5f,ny=(y+tile*.5f)/source.Height-.5f;
            float distance=(float)Math.Sqrt(nx*nx+ny*ny),angle=(float)Math.Atan2(ny,nx)+(Next()-.5f)*.8f;
            float travel=55+Next()*115;
            tiles.Add(new Tile{Source=new Rectangle(x,y,Math.Min(tile,source.Width-x),Math.Min(tile,source.Height-y)),Delay=.04f+distance*.18f+Next()*.13f,DX=(float)Math.Cos(angle)*travel,DY=(float)Math.Sin(angle)*travel-Next()*25,Wave=Next()*6.28f,Size=3+Next()*6});
        }
        // One persistent DIB and DC: no per-frame bitmap/handle churn.
        // Reject unusually large native surfaces instead of monopolizing desktop rendering.
        if((long)Width*Height>9000000)throw new InvalidOperationException("Close surface too large");
        try{
            memoryDC=CreateCompatibleDC(IntPtr.Zero);if(memoryDC==IntPtr.Zero)throw new InvalidOperationException("Close DC unavailable");
            var info=new BitmapInfo{Size=(uint)Marshal.SizeOf(typeof(BitmapInfo)),Width=Width,Height=-Height,Planes=1,BitCount=32};
            dib=CreateDIBSection(memoryDC,ref info,0,out bits,IntPtr.Zero,0);if(dib==IntPtr.Zero||bits==IntPtr.Zero)throw new InvalidOperationException("Close surface unavailable");
            previousBitmap=SelectObject(memoryDC,dib);
            frame=new Bitmap(Width,Height,Width*4,PixelFormat.Format32bppPArgb,bits);
        }catch{Dispose();throw;}
    }
    internal unsafe void Render(float progress){
        if(frame==null||Width!=frame.Width||Height!=frame.Height)throw new InvalidOperationException("Close surface resized");
        // Direct bounded nearest-neighbour raster avoids hundreds of expensive
        // GDI+ image/color-matrix calls per frame. Source is already premultiplied.
        uint* output=(uint*)bits.ToPointer();int total=Width*Height;
        for(int pixel=0;pixel<total;pixel++)output[pixel]=0;
        float sx=(float)origin.Width/source.Width,sy=(float)origin.Height/source.Height;
        int ox=origin.Left-Left,oy=origin.Top-Top;
        foreach(var tile in tiles){
            float t=Math.Max(0,Math.Min(1,(progress-tile.Delay)/(1-tile.Delay)));
            if(t>=1)continue;
            float move=Ease(t),size=1-Ease(Math.Min(1,t*1.2f)),fade=1-Ease(Math.Max(0,(t-.4f)/.6f));
            float wobble=(float)Math.Sin(t*22+tile.Wave)*(float)Math.Sin(t*Math.PI)*7;
            float w=tile.Source.Width*sx,h=tile.Source.Height*sy,small=Math.Min(tile.Size,Math.Min(w,h));
            float dw=small+(w-small)*size,dh=small+(h-small)*size;
            int x=(int)Math.Round(ox+tile.Source.X*sx+(w-dw)/2+tile.DX*move+wobble),y=(int)Math.Round(oy+tile.Source.Y*sy+(h-dh)/2+tile.DY*move);
            int width=Math.Max(1,(int)Math.Ceiling(dw)),height=Math.Max(1,(int)Math.Ceiling(dh)),opacity=(int)(fade*255);
            int left=Math.Max(0,x),right=Math.Min(Width,x+width),top=Math.Max(0,y),bottom=Math.Min(Height,y+height);
            for(int py=top;py<bottom;py++){
                int from=(tile.Source.Y+(py-y)*tile.Source.Height/height)*source.Width+tile.Source.X;
                for(int px=left;px<right;px++){
                    uint value=(uint)sourcePixels[from+(px-x)*tile.Source.Width/width];
                    uint a=(value>>24)*(uint)opacity/255;if(a==0)continue;
                    uint r=((value>>16)&255)*(uint)opacity/255,g=((value>>8)&255)*(uint)opacity/255,b=(value&255)*(uint)opacity/255;
                    output[py*Width+px]=(a<<24)|(r<<16)|(g<<8)|b;
                }
            }
        }
        var point=new Point(Left,Top);var offset=new Point();var sizeNative=new NativeSize{Width=Width,Height=Height};var blend=new Blend{Alpha=255,Format=1};
        if(!UpdateLayeredWindow(Handle,IntPtr.Zero,ref point,ref sizeNative,memoryDC,ref offset,0,ref blend,2))throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    }
    internal async Task Play(Form owner,Action revealDesktop){
        Render(0);Show(owner);DwmFlush();revealDesktop();
        var clock=Stopwatch.StartNew();
        while(!IsDisposed&&clock.ElapsedMilliseconds<DurationMs){
            long start=clock.ElapsedMilliseconds;Render(Math.Min(1,(float)start/DurationMs));
            // Time-based trajectories skip late frames rather than stretching the close.
            await Task.Delay(Math.Max(1,22-(int)(clock.ElapsedMilliseconds-start)));
        }
        if(!IsDisposed)Render(1);
    }
    protected override void Dispose(bool disposing){
        if(disposing){if(frame!=null){frame.Dispose();frame=null;}
            if(memoryDC!=IntPtr.Zero&&previousBitmap!=IntPtr.Zero)SelectObject(memoryDC,previousBitmap);
            if(dib!=IntPtr.Zero){DeleteObject(dib);dib=IntPtr.Zero;}if(memoryDC!=IntPtr.Zero){DeleteDC(memoryDC);memoryDC=IntPtr.Zero;}}
        base.Dispose(disposing);
    }
}
