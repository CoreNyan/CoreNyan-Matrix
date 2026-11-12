using System;
using System.IO;
using System.Drawing;
using System.Diagnostics;
using System.Threading;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

internal sealed class MatrixShell : Form {
    const int WindowCornerPreference=33,RoundCorners=2,ImmersiveDarkMode=20,WindowBorderColor=34;
    static readonly string Root=AppDomain.CurrentDomain.BaseDirectory;
    readonly JavaScriptSerializer json=new JavaScriptSerializer { MaxJsonLength=13000000 };
    WebView2 web=new WebView2();
    bool rendererFailed;
    readonly Panel titlebar=new Panel(),offline=new Panel(),viewport=new Panel();
    readonly NotifyIcon notification=new NotifyIcon();
    readonly Uri endpoint;
    readonly string certificate,userAgent;
    string notificationRoute="/CHAT";
    [DllImport("user32.dll")] static extern bool ReleaseCapture();
    [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr h,int m,IntPtr w,IntPtr l);
    [DllImport("user32.dll")] static extern IntPtr FindWindow(string cls,string title);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h,int mode);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr window,uint flags);
    [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr monitor,ref MonitorInfo info);
    [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr window);
    [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr window,int attribute,ref int value,int size);
    [DllImport("dwmapi.dll")] static extern int DwmExtendFrameIntoClientArea(IntPtr window,ref FrameMargins margins);
    [StructLayout(LayoutKind.Sequential)] struct FrameMargins { public int Left,Right,Top,Bottom; }
    [StructLayout(LayoutKind.Sequential)] struct NativePoint { public int X,Y; }
    [StructLayout(LayoutKind.Sequential)] struct NativeRect { public int Left,Top,Right,Bottom; }
    [StructLayout(LayoutKind.Sequential)] struct MonitorInfo { public int Size;public NativeRect Monitor,Work;public uint Flags; }
    [StructLayout(LayoutKind.Sequential)] struct MinMaxInfo { public NativePoint Reserved,MaxSize,MaxPosition,MinTrackSize,MaxTrackSize; }
    sealed class CaptionButton : Button {
        bool hovered;
        public Color HoverColor {get;set;}
        public CaptionButton(){SetStyle(ControlStyles.UserPaint|ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer,true);TabStop=false;}
        protected override bool ShowFocusCues {get{return false;}}
        public override void NotifyDefault(bool value){base.NotifyDefault(false);}
        protected override void OnMouseEnter(EventArgs e){hovered=true;Invalidate();base.OnMouseEnter(e);}
        protected override void OnMouseLeave(EventArgs e){hovered=false;Invalidate();base.OnMouseLeave(e);}
        protected override void OnPaint(PaintEventArgs e){e.Graphics.Clear(hovered?HoverColor:BackColor);TextRenderer.DrawText(e.Graphics,Text,Font,ClientRectangle,ForeColor,TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter|TextFormatFlags.NoPadding);}
    }
    [STAThread] static int Main(string[] args) {
        if(args.Length>0&&args[0]=="--check-runtime") { try { CoreWebView2Environment.GetAvailableBrowserVersionString();return 0; } catch { return 2; } }
        bool first;using(var mutex=new Mutex(true,"Local\\CoreNyanMatrixDesktop",out first)) {
            if(!first) {var h=FindWindow(null,"CoreNyan");ShowWindow(h,9);SetForegroundWindow(h);return 0;}
            SetProcessDPIAware();Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
            try {Application.Run(new MatrixShell());return 0;}catch(Exception e){MessageBox.Show("CoreNyan 无法启动："+e.Message,"CoreNyan");return 1;}
        }
    }
    MatrixShell() {
        var config=json.Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(Root,"product.json")));
        endpoint=new Uri((string)config["serverUrl"]);userAgent=(string)config["userAgent"];
        certificate=CleanPem(File.ReadAllText(Path.Combine(Root,(string)config["certificate"])));
        Text="CoreNyan";Icon=new Icon(Path.Combine(Root,"icon.ico"));BackColor=Color.FromArgb(9,9,9);ForeColor=Color.White;
        FormBorderStyle=FormBorderStyle.None;MinimumSize=new Size(480,600);Size=new Size(1440,950);StartPosition=FormStartPosition.CenterScreen;
        Padding=new Padding(5,0,5,5);Font=new Font("Microsoft YaHei UI",10);
        var layout=new TableLayoutPanel {Dock=DockStyle.Fill,ColumnCount=1,RowCount=2,Margin=Padding.Empty,Padding=Padding.Empty};
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,42));layout.RowStyles.Add(new RowStyle(SizeType.Percent,100));Controls.Add(layout);
        titlebar.Dock=DockStyle.Fill;titlebar.Margin=Padding.Empty;titlebar.BackColor=BackColor;
        viewport.Dock=DockStyle.Fill;viewport.Margin=Padding.Empty;layout.Controls.Add(titlebar,0,0);layout.Controls.Add(viewport,0,1);
        var name=new Label {Text="CoreNyan",Dock=DockStyle.Fill,TextAlign=ContentAlignment.MiddleLeft,Padding=new Padding(14,0,0,0),Font=new Font("Segoe UI",12,FontStyle.Bold)};
        titlebar.Controls.Add(name);name.MouseDown+=Drag;titlebar.MouseDown+=Drag;name.DoubleClick+=(s,e)=>Maximize();
        AddWindowButton("×",()=>Close(),true);AddWindowButton("□",Maximize,false);AddWindowButton("−",()=>WindowState=FormWindowState.Minimized,false);
        web.Dock=DockStyle.Fill;web.DefaultBackgroundColor=BackColor;viewport.Controls.Add(web);
        offline.Dock=DockStyle.Fill;offline.BackColor=BackColor;offline.Visible=false;
        var retry=new Button {Text="重新连接",Size=new Size(140,42),FlatStyle=FlatStyle.Flat};retry.Click+=async(s,e)=>{
            retry.Enabled=false;try{if(rendererFailed){web.Dispose();web=new WebView2 {Dock=DockStyle.Fill,DefaultBackgroundColor=BackColor};viewport.Controls.Add(web);web.SendToBack();rendererFailed=false;await Initialize();}else web.CoreWebView2.Navigate(endpoint.AbsoluteUri);offline.Visible=false;}catch{offline.Visible=true;}finally{retry.Enabled=true;}
        };
        var label=new Label {Text="暂时连接不上小可",AutoSize=true,Font=new Font(Font.FontFamily,15,FontStyle.Bold)};
        offline.Controls.Add(label);offline.Controls.Add(retry);offline.Resize+=(s,e)=>{label.Location=new Point((offline.Width-label.Width)/2,offline.Height/2-50);retry.Location=new Point((offline.Width-retry.Width)/2,offline.Height/2+10);};viewport.Controls.Add(offline);offline.BringToFront();
        notification.Icon=Icon;notification.Text="CoreNyan";notification.Visible=true;notification.BalloonTipClicked+=(s,e)=>{Show();WindowState=FormWindowState.Normal;Activate();if(web.CoreWebView2!=null)web.CoreWebView2.Navigate(new Uri(endpoint,notificationRoute).AbsoluteUri);};
        FormClosed+=(s,e)=>{notification.Dispose();web.Dispose();};Shown+=async(s,e)=>await Initialize();
    }
    void AddWindowButton(string text,Action action,bool close){var b=new CaptionButton {Text=text,Dock=DockStyle.Right,Width=48,FlatStyle=FlatStyle.Flat,BackColor=BackColor,ForeColor=ForeColor,HoverColor=close?Color.FromArgb(150,40,40):Color.FromArgb(38,38,38),Font=new Font("Segoe UI",15)};b.FlatAppearance.BorderSize=0;b.Click+=(s,e)=>action();titlebar.Controls.Add(b);b.BringToFront();}
    void Drag(object sender,MouseEventArgs e){if(e.Button==MouseButtons.Left){ReleaseCapture();SendMessage(Handle,0xA1,new IntPtr(2),IntPtr.Zero);}}
    void Maximize(){MaximizedBounds=Screen.FromHandle(Handle).WorkingArea;WindowState=WindowState==FormWindowState.Maximized?FormWindowState.Normal:FormWindowState.Maximized;}
    protected override CreateParams CreateParams {get{
        var p=base.CreateParams;
        // Keep a real resizable frame for DWM shadow, antialiasing and Windows snap.
        // WM_NCCALCSIZE makes its caption client-owned; never set an HWND region.
        p.Style|=0x00C00000|0x00040000|0x00080000|0x00020000|0x00010000;
        return p;
    }}
    protected override void OnHandleCreated(EventArgs e){base.OnHandleCreated(e);UpdateWindowFrame();}
    void UpdateWindowFrame(){
        if(!IsHandleCreated)return;
        int corner=RoundCorners,dark=1,border=0x00333333;
        DwmSetWindowAttribute(Handle,WindowCornerPreference,ref corner,sizeof(int));
        DwmSetWindowAttribute(Handle,ImmersiveDarkMode,ref dark,sizeof(int));
        DwmSetWindowAttribute(Handle,WindowBorderColor,ref border,sizeof(int));
        var margins=new FrameMargins {Left=1,Right=1,Top=1,Bottom=1};
        DwmExtendFrameIntoClientArea(Handle,ref margins);
    }
    protected override void WndProc(ref Message m){
        if(m.Msg==0x83&&m.WParam!=IntPtr.Zero){
            // Maximized HWND includes invisible resize margins; its content must
            // use the monitor work area so the titlebar and composer stay visible.
            if(IsZoomed(Handle)){var info=new MonitorInfo {Size=Marshal.SizeOf(typeof(MonitorInfo))};if(GetMonitorInfo(MonitorFromWindow(Handle,2),ref info))Marshal.StructureToPtr(info.Work,m.LParam,false);}
            m.Result=IntPtr.Zero;return;
        }
        if(m.Msg==0x31E){base.WndProc(ref m);UpdateWindowFrame();return;}
        if(m.Msg==0x24){
            base.WndProc(ref m);var info=new MonitorInfo {Size=Marshal.SizeOf(typeof(MonitorInfo))};
            if(GetMonitorInfo(MonitorFromWindow(Handle,2),ref info)){var limits=(MinMaxInfo)Marshal.PtrToStructure(m.LParam,typeof(MinMaxInfo));limits.MaxPosition=new NativePoint {X=info.Work.Left-info.Monitor.Left,Y=info.Work.Top-info.Monitor.Top};limits.MaxSize=new NativePoint {X=info.Work.Right-info.Work.Left,Y=info.Work.Bottom-info.Work.Top};Marshal.StructureToPtr(limits,m.LParam,false);}return;
        }
        const int hitTest=0x84;if(m.Msg==hitTest&&WindowState==FormWindowState.Normal){base.WndProc(ref m);var p=PointToClient(new Point((short)((long)m.LParam&0xffff),(short)(((long)m.LParam>>16)&0xffff)));bool l=p.X<6,r=p.X>=ClientSize.Width-6,t=p.Y<5,b=p.Y>=ClientSize.Height-6;int hit=t?(l?13:r?14:12):b?(l?16:r?17:15):l?10:r?11:0;if(hit!=0)m.Result=new IntPtr(hit);return;}base.WndProc(ref m);
    }
    bool Trusted(string value){Uri u;return Uri.TryCreate(value,UriKind.Absolute,out u)&&u.Scheme=="https"&&u.UserInfo==""&&u.Authority==endpoint.Authority;}
    static string CleanPem(string s){return s.Replace("-----BEGIN CERTIFICATE-----","").Replace("-----END CERTIFICATE-----","").Replace("\r","").Replace("\n","").Trim();}
    void External(string url){Uri u;if(Uri.TryCreate(url,UriKind.Absolute,out u)&&(u.Scheme=="https"||u.Scheme=="http")&&u.UserInfo=="")Process.Start(new ProcessStartInfo(url){UseShellExecute=true});}
    async System.Threading.Tasks.Task Initialize(){
        try {
            var env=await CoreWebView2Environment.CreateAsync(null,Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"CoreNyan","WebView2"));
            await web.EnsureCoreWebView2Async(env);var core=web.CoreWebView2;
            core.Settings.UserAgent+=" "+userAgent;core.Settings.AreDevToolsEnabled=false;core.Settings.AreDefaultContextMenusEnabled=false;core.Settings.IsStatusBarEnabled=false;
            core.ServerCertificateErrorDetected+=(s,e)=>{e.Action=Trusted(e.RequestUri)&&CleanPem(e.ServerCertificate.ToPemEncoding())==certificate?CoreWebView2ServerCertificateErrorAction.AlwaysAllow:CoreWebView2ServerCertificateErrorAction.Cancel;};
            core.NavigationStarting+=(s,e)=>{offline.Visible=false;if(!Trusted(e.Uri)){e.Cancel=true;External(e.Uri);}};
            core.NewWindowRequested+=(s,e)=>{e.Handled=true;if(Trusted(e.Uri))core.Navigate(e.Uri);else External(e.Uri);};
            core.NavigationCompleted+=(s,e)=>{if(!e.IsSuccess&&e.WebErrorStatus!=CoreWebView2WebErrorStatus.OperationCanceled){offline.Visible=true;offline.BringToFront();titlebar.BringToFront();}};
            core.ProcessFailed+=(s,e)=>{rendererFailed=true;offline.Visible=true;offline.BringToFront();titlebar.BringToFront();};
            core.PermissionRequested+=(s,e)=>{e.State=Trusted(e.Uri)&&(e.PermissionKind==CoreWebView2PermissionKind.Notifications||e.PermissionKind==CoreWebView2PermissionKind.ClipboardRead&&e.IsUserInitiated)?CoreWebView2PermissionState.Allow:CoreWebView2PermissionState.Deny;};
            core.DownloadStarting+=(s,e)=>{if(!Trusted(e.DownloadOperation.Uri)&&!e.DownloadOperation.Uri.StartsWith("blob:"+endpoint.GetLeftPart(UriPartial.Authority)+"/")){e.Cancel=true;return;}using(var picker=new SaveFileDialog {Title="保存文件",FileName=Path.GetFileName(e.ResultFilePath)}){e.Handled=true;if(picker.ShowDialog(this)==DialogResult.OK)e.ResultFilePath=picker.FileName;else e.Cancel=true;}};
            core.WebMessageReceived+=MessageFromPage;
            string bridge=File.ReadAllText(Path.Combine(Root,"bridge.js")).Replace("__MATRIX_ORIGIN__",json.Serialize(endpoint.GetLeftPart(UriPartial.Authority)));
            await core.AddScriptToExecuteOnDocumentCreatedAsync(bridge);core.Navigate(endpoint.AbsoluteUri);
        }catch(WebView2RuntimeNotFoundException){if(MessageBox.Show("此电脑尚未安装 Microsoft Edge WebView2。前往微软安装页面？","CoreNyan",MessageBoxButtons.YesNo)==DialogResult.Yes)External("https://developer.microsoft.com/microsoft-edge/webview2/");Close();}
        catch(Exception e){MessageBox.Show("页面初始化失败："+e.Message,"CoreNyan");Close();}
    }
    void MessageFromPage(object sender,CoreWebView2WebMessageReceivedEventArgs e){
        if(!Trusted(e.Source)||!Trusted(web.Source.AbsoluteUri))return;string id="";object value=null;string error=null;
        try {
            if(e.WebMessageAsJson.Length>12000000)throw new Exception("请求过大");var p=json.Deserialize<Dictionary<string,object>>(e.WebMessageAsJson);id=Convert.ToString(p["id"]);var action=Convert.ToString(p["action"]);object input;p.TryGetValue("value",out input);
            switch(action){
                case "writeClipboard":Clipboard.SetText(Convert.ToString(input)??"");value=true;break;
                case "readClipboard":value=Clipboard.ContainsText()?Clipboard.GetText():"";break;
                case "writeImage":using(var stream=new MemoryStream(Convert.FromBase64String(Convert.ToString(input))))using(var image=Image.FromStream(stream)){if((long)image.Width*image.Height>32000000)throw new Exception("图片尺寸过大");using(var bitmap=new Bitmap(image))Clipboard.SetImage(bitmap);}value=true;break;
                case "getNotificationPermission":value="granted";break;
                case "openNotificationSettings":System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("ms-settings:notifications"){UseShellExecute=true});value=true;break;
                case "notify":var n=(Dictionary<string,object>)input;var route=Convert.ToString(n["route"]);notificationRoute=System.Text.RegularExpressions.Regex.IsMatch(route??"",@"^/CHAT(/[a-f0-9-]+)?$")?route:"/CHAT";notification.BalloonTipTitle=Short(Convert.ToString(n["title"]),120);notification.BalloonTipText=Short(Convert.ToString(n["body"]),300);notification.ShowBalloonTip(5000);value=true;break;
                default:throw new Exception("不支持的操作");
            }
        }catch(Exception ex){error=ex.Message;}
        web.CoreWebView2.PostWebMessageAsJson(json.Serialize(new {id=id,value=value,error=error}));
    }
    static string Short(string s,int n){return (s??"").Substring(0,Math.Min((s??"").Length,n));}
}
