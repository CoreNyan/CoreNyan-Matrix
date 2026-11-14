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
    const int WindowCornerPreference=33,RoundCorners=2,ImmersiveDarkMode=20,WindowBorderColor=34,TransitionsForceDisabled=3;
    static readonly string Root=AppDomain.CurrentDomain.BaseDirectory;
    readonly JavaScriptSerializer json=new JavaScriptSerializer { MaxJsonLength=13000000 };
    WebView2 web=new WebView2();
    bool rendererFailed,closingAnimation,closeReady,windowPresented,chromeReady,changingWindow,nativeMotion=true;
    int fadeGeneration;Rectangle? restoringBounds;bool nativeRestorePending;
    const int CloseFallbackMs=200,CloseScriptTimeoutMs=250,MaxCloseAnimationMs=1400;
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
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window,out NativeRect rect);
    [DllImport("user32.dll")] static extern bool SystemParametersInfo(uint action,uint parameter,out bool value,uint flags);
    [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr window,int attribute,ref int value,int size);
    [DllImport("dwmapi.dll")] static extern int DwmExtendFrameIntoClientArea(IntPtr window,ref FrameMargins margins);
    [StructLayout(LayoutKind.Sequential)] struct FrameMargins { public int Left,Right,Top,Bottom; }
    [StructLayout(LayoutKind.Sequential)] struct NativePoint { public int X,Y; }
    [StructLayout(LayoutKind.Sequential)] struct NativeRect { public int Left,Top,Right,Bottom; }
    [StructLayout(LayoutKind.Sequential)] struct MonitorInfo { public int Size;public NativeRect Monitor,Work;public uint Flags; }
    [StructLayout(LayoutKind.Sequential)] struct MinMaxInfo { public NativePoint Reserved,MaxSize,MaxPosition,MinTrackSize,MaxTrackSize; }
    enum CaptionAction { Minimize, Maximize, Close }
    sealed class CaptionButton : Button {
        readonly System.Windows.Forms.Timer motion=new System.Windows.Forms.Timer {Interval=16};
        readonly Stopwatch elapsed=Stopwatch.StartNew();
        bool hovered,pressed,dispatching;
        float hover,press,pulse=1;
        long last;
        public CaptionAction Kind {get;set;}
        public bool Restored {get;set;}
        public CaptionButton(){
            SetStyle(ControlStyles.UserPaint|ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer,true);
            TabStop=false;motion.Tick+=(s,e)=>Advance();
        }
        public override void NotifyDefault(bool value){base.NotifyDefault(false);}
        void Animate(){
            if(!ClientAnimationsEnabled()){hover=hovered?1:0;press=pressed?1:0;pulse=1;motion.Stop();Invalidate();return;}
            if(!motion.Enabled){last=elapsed.ElapsedMilliseconds;motion.Start();}Invalidate();
        }
        void Advance(){
            long now=elapsed.ElapsedMilliseconds;float dt=Math.Min(64,now-last);last=now;
            float target=hovered?1:0,down=pressed?1:0;
            hover+=(target-hover)*(1-(float)Math.Exp(-dt/55));press+=(down-press)*(1-(float)Math.Exp(-dt/35));
            pulse=Math.Min(1,pulse+dt/280);
            if(Math.Abs(target-hover)<.004f&&Math.Abs(down-press)<.004f&&pulse==1){hover=target;press=down;motion.Stop();}
            Invalidate();
        }
        protected override void OnMouseEnter(EventArgs e){hovered=true;Animate();base.OnMouseEnter(e);}
        protected override void OnMouseLeave(EventArgs e){hovered=false;Animate();base.OnMouseLeave(e);}
        protected override void OnMouseDown(MouseEventArgs e){if(e.Button==MouseButtons.Left){pressed=true;pulse=0;Animate();}base.OnMouseDown(e);}
        protected override void OnMouseUp(MouseEventArgs e){pressed=false;Animate();base.OnMouseUp(e);}
        protected override void OnMouseCaptureChanged(EventArgs e){pressed=false;Animate();base.OnMouseCaptureChanged(e);}
        protected override async void OnClick(EventArgs e){
            if(dispatching)return;dispatching=true;
            try{if(ClientAnimationsEnabled())await System.Threading.Tasks.Task.Delay(90);if(!IsDisposed&&Enabled)base.OnClick(e);}finally{dispatching=false;}
        }
        static System.Drawing.Drawing2D.GraphicsPath Rounded(RectangleF r,float radius){
            var p=new System.Drawing.Drawing2D.GraphicsPath();float d=radius*2;
            p.AddArc(r.Left,r.Top,d,d,180,90);p.AddArc(r.Right-d,r.Top,d,d,270,90);p.AddArc(r.Right-d,r.Bottom-d,d,d,0,90);p.AddArc(r.Left,r.Bottom-d,d,d,90,90);p.CloseFigure();return p;
        }
        protected override void OnPaint(PaintEventArgs e){
            var g=e.Graphics;g.Clear(BackColor);g.SmoothingMode=System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            float unit=Math.Min(Width/48f,Height/42f);
            g.TranslateTransform(Width/2f,Height/2f);g.ScaleTransform(unit,unit);
            var bg=Kind==CaptionAction.Close?Color.FromArgb(172,53,57):Color.FromArgb(90,90,90);
            using(var shape=Rounded(new RectangleF(-19,-16,38,32),9))
            using(var fill=new SolidBrush(Color.FromArgb((int)(hover*110+press*35),bg)))g.FillPath(fill,shape);
            if(pulse<1){float v=1-(1-pulse)*(1-pulse);using(var ring=Rounded(new RectangleF(-12-7*v,-10-6*v,24+14*v,20+12*v),7))using(var pen=new Pen(Color.FromArgb((int)(75*(1-pulse)),ForeColor),1))g.DrawPath(pen,ring);}
            g.ScaleTransform(1-.16f*press,1-.16f*press);
            using(var pen=new Pen(Color.FromArgb((int)(185+70*hover),ForeColor),1.55f)){
                pen.StartCap=pen.EndCap=System.Drawing.Drawing2D.LineCap.Round;pen.LineJoin=System.Drawing.Drawing2D.LineJoin.Round;
                if(Kind==CaptionAction.Minimize){g.TranslateTransform(0,hover*2);g.DrawLine(pen,-6,3,6,3);}
                else if(Kind==CaptionAction.Close){g.RotateTransform(hover*90);g.DrawLine(pen,-5,-5,5,5);g.DrawLine(pen,5,-5,-5,5);}
                else if(Restored){g.DrawLines(pen,new[]{new PointF(-2,-6),new PointF(6,-6),new PointF(6,2)});using(var box=Rounded(new RectangleF(-6,-2,8,8),1.4f))g.DrawPath(pen,box);}
                else {float v=hover;g.DrawLines(pen,new[]{new PointF(-6-v,-1),new PointF(-6-v,-6-v),new PointF(-1,-6-v)});g.DrawLines(pen,new[]{new PointF(1,6+v),new PointF(6+v,6+v),new PointF(6+v,1)});}
            }
        }
        protected override void Dispose(bool disposing){if(disposing)motion.Dispose();base.Dispose(disposing);}
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
        if(ClientAnimationsEnabled())Opacity=0;
        Padding=Padding.Empty;Font=new Font("Microsoft YaHei UI",10);
        viewport.Dock=DockStyle.Fill;viewport.Margin=Padding.Empty;Controls.Add(viewport);
        titlebar.Height=42;titlebar.Dock=DockStyle.Top;titlebar.Margin=Padding.Empty;titlebar.BackColor=BackColor;titlebar.Visible=false;Controls.Add(titlebar);
        titlebar.MouseDown+=Drag;titlebar.DoubleClick+=(s,e)=>Maximize();
        AddWindowButton(CaptionAction.Close,()=>Close());AddWindowButton(CaptionAction.Maximize,Maximize);AddWindowButton(CaptionAction.Minimize,Minimize);
        Resize+=(s,e)=>{foreach(Control control in titlebar.Controls){var button=control as CaptionButton;if(button!=null&&button.Kind==CaptionAction.Maximize){button.Restored=WindowState==FormWindowState.Maximized;button.AccessibleName=button.Restored?"还原":"最大化";button.Invalidate();}}if(web.CoreWebView2!=null&&chromeReady)web.CoreWebView2.PostWebMessageAsJson(json.Serialize(new {type="windowState",maximized=WindowState==FormWindowState.Maximized}));};
        web.Dock=DockStyle.Fill;web.DefaultBackgroundColor=Color.White;viewport.Controls.Add(web);
        offline.Dock=DockStyle.Fill;offline.BackColor=BackColor;offline.Visible=false;
        var retry=new Button {Text="重新连接",Size=new Size(140,42),FlatStyle=FlatStyle.Flat};retry.Click+=async(s,e)=>{
            retry.Enabled=false;try{if(rendererFailed){web.Dispose();web=new WebView2 {Dock=DockStyle.Fill,DefaultBackgroundColor=Color.White};viewport.Controls.Add(web);web.SendToBack();rendererFailed=false;await Initialize();}else web.CoreWebView2.Navigate(endpoint.AbsoluteUri);offline.Visible=false;}catch{offline.Visible=true;}finally{retry.Enabled=true;}
        };
        var label=new Label {Text="暂时连接不上小可",AutoSize=true,Font=new Font(Font.FontFamily,15,FontStyle.Bold)};
        offline.Controls.Add(label);offline.Controls.Add(retry);offline.Resize+=(s,e)=>{label.Location=new Point((offline.Width-label.Width)/2,offline.Height/2-50);retry.Location=new Point((offline.Width-retry.Width)/2,offline.Height/2+10);};viewport.Controls.Add(offline);offline.BringToFront();
        notification.Icon=Icon;notification.Text="CoreNyan";notification.Visible=true;notification.BalloonTipClicked+=(s,e)=>{Show();WindowState=FormWindowState.Normal;Activate();if(web.CoreWebView2!=null)web.CoreWebView2.Navigate(new Uri(endpoint,notificationRoute).AbsoluteUri);};
        FormClosed+=(s,e)=>{notification.Dispose();web.Dispose();};Shown+=async(s,e)=>{PresentFallback();await Initialize();};
    }
    async void PresentFallback(){await System.Threading.Tasks.Task.Delay(3000);if(!IsDisposed&&!chromeReady)titlebar.Visible=true;PresentWindow();}
    async void PresentWindow(){
        if(windowPresented||closingAnimation||IsDisposed)return;windowPresented=true;
        if(ClientAnimationsEnabled())await FadeWindow(1,380,true);else Opacity=1;
    }
    async System.Threading.Tasks.Task FadeWindow(double target,int duration,bool opening=false){
        int generation=++fadeGeneration;double start=Opacity;var elapsed=Stopwatch.StartNew();
        while(!IsDisposed&&generation==fadeGeneration&&(!opening||!closingAnimation)){
            double t=Math.Min(1,(double)elapsed.ElapsedMilliseconds/Math.Max(1,duration));
            double eased=t*t*(3-2*t);Opacity=start+(target-start)*eased;
            if(t>=1)break;await System.Threading.Tasks.Task.Delay(16);
        }
    }
    void AddWindowButton(CaptionAction kind,Action action){
        var b=new CaptionButton {Kind=kind,AccessibleName=kind==CaptionAction.Close?"关闭":kind==CaptionAction.Maximize?"最大化":"最小化",Dock=DockStyle.Right,Width=48,FlatStyle=FlatStyle.Flat,BackColor=BackColor,ForeColor=ForeColor};
        b.FlatAppearance.BorderSize=0;b.Click+=(s,e)=>action();titlebar.Controls.Add(b);b.BringToFront();
    }
    void Drag(object sender,MouseEventArgs e){if(e.Button==MouseButtons.Left){ReleaseCapture();SendMessage(Handle,0xA1,new IntPtr(2),IntPtr.Zero);}}
    // DWM is the only owner of minimize/maximize/restore transitions. Resizing the
    // HWND by hand and resetting it before ShowWindow makes WebView2 repaint twice.
    // Opacity and GDI snapshot overlays also compete with the native compositor.
    void UpdateWindowMotion(){
        if(!IsHandleCreated)return;
        int disabled=nativeMotion&&ClientAnimationsEnabled()?0:1;
        DwmSetWindowAttribute(Handle,TransitionsForceDisabled,ref disabled,sizeof(int));
    }
    void ChangeWindowState(FormWindowState state){
        if(changingWindow||closingAnimation||IsDisposed)return;
        changingWindow=true;
        try{
            ++fadeGeneration; // Cancel a pending startup fade before handing off to DWM.
            Opacity=1;UpdateWindowMotion();
            if(state==FormWindowState.Maximized)MaximizedBounds=Screen.FromHandle(Handle).WorkingArea;
            // Let native WINDOWPLACEMENT retain outer bounds. WinForms' restore
            // setter adds caption margins even though WM_NCCALCSIZE removes them.
            ShowWindow(Handle,state==FormWindowState.Maximized?3:state==FormWindowState.Minimized?6:9);
        }finally{changingWindow=false;}
    }
    void Minimize(){ChangeWindowState(FormWindowState.Minimized);}
    void Maximize(){ChangeWindowState(WindowState==FormWindowState.Maximized?FormWindowState.Normal:FormWindowState.Maximized);}
    protected override void OnFormClosing(FormClosingEventArgs e){
        base.OnFormClosing(e);
        // Do not delay OS shutdown or a close cancelled by another handler.
        if(e.Cancel||closeReady||e.CloseReason!=CloseReason.UserClosing)return;
        e.Cancel=true;if(closingAnimation)return;closingAnimation=true;titlebar.Enabled=false;
        AnimateClose();
    }
    async void AnimateClose(){
        try{
            int duration=0;bool animated=false;
            if(web.CoreWebView2!=null&&!rendererFailed&&web.Source!=null&&Trusted(web.Source.AbsoluteUri)){
                var script=web.CoreWebView2.ExecuteScriptAsync("window.MatrixTerminal ? window.MatrixTerminal.close() : -1");
                if(await System.Threading.Tasks.Task.WhenAny(script,System.Threading.Tasks.Task.Delay(CloseScriptTimeoutMs))==script){
                    int value;if(int.TryParse(await script,out value)&&value>=0){duration=Math.Min(value,MaxCloseAnimationMs);animated=true;}
                }
            }
            if(animated&&duration>0){
                // The HWND, titlebar and page leave together, before a black frame remains.
                int lead=Math.Max(0,duration-300);await System.Threading.Tasks.Task.Delay(lead);
                if(ClientAnimationsEnabled())await FadeWindow(0,duration-lead);
                else await System.Threading.Tasks.Task.Delay(duration-lead);
            }
            else if(!animated&&ClientAnimationsEnabled())await FadeWindow(0,CloseFallbackMs);
        }catch{ /* A failed renderer must never trap the window open. */ }
        finally{closeReady=true;if(!IsDisposed)Close();}
    }
    static bool ClientAnimationsEnabled(){bool enabled;return SystemParametersInfo(0x1042,0,out enabled,0)&&enabled;}
    protected override void SetBoundsCore(int x,int y,int width,int height,BoundsSpecified specified){
        // During native restore, Form converts its cached client size into an outer
        // size with caption insets. Our zero-inset frame already has the correct
        // native WINDOWPLACEMENT; preserve it before Form can issue a second resize.
        if(restoringBounds.HasValue){var r=restoringBounds.Value;x=r.X;y=r.Y;width=r.Width;height=r.Height;}
        base.SetBoundsCore(x,y,width,height,specified);
    }
    protected override CreateParams CreateParams {get{
        var p=base.CreateParams;
        // Keep a real resizable frame for DWM shadow, antialiasing and Windows snap.
        // WM_NCCALCSIZE makes its caption client-owned; never set an HWND region.
        p.Style|=0x00C00000|0x00040000|0x00080000|0x00020000|0x00010000;
        return p;
    }}
    protected override void OnHandleCreated(EventArgs e){base.OnHandleCreated(e);UpdateWindowFrame();UpdateWindowMotion();}
    void UpdateWindowFrame(){
        if(!IsHandleCreated)return;
        int corner=RoundCorners,dark=1,border=unchecked((int)0xFFFFFFFE);
        DwmSetWindowAttribute(Handle,WindowCornerPreference,ref corner,sizeof(int));
        DwmSetWindowAttribute(Handle,ImmersiveDarkMode,ref dark,sizeof(int));
        DwmSetWindowAttribute(Handle,WindowBorderColor,ref border,sizeof(int));
        var margins=new FrameMargins {Left=0,Right=0,Top=0,Bottom=0};
        DwmExtendFrameIntoClientArea(Handle,ref margins);
    }
    protected override void WndProc(ref Message m){
        if((m.Msg==0x46||m.Msg==0x47)&&(IsZoomed(Handle)||IsIconic(Handle)))nativeRestorePending=true;
        if(m.Msg==0x47&&nativeRestorePending&&!IsZoomed(Handle)&&!IsIconic(Handle)){
            nativeRestorePending=false;
            NativeRect rect;if(GetWindowRect(Handle,out rect)){
                var prior=restoringBounds;restoringBounds=Rectangle.FromLTRB(rect.Left,rect.Top,rect.Right,rect.Bottom);
                try{base.WndProc(ref m);}finally{restoringBounds=prior;}return;
            }
        }
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
            var env=await CoreWebView2Environment.CreateAsync(null,Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"CoreNyan","WebView2"),new CoreWebView2EnvironmentOptions("--autoplay-policy=no-user-gesture-required"));
            await web.EnsureCoreWebView2Async(env);var core=web.CoreWebView2;
            core.Settings.UserAgent+=" "+userAgent;core.Settings.AreDevToolsEnabled=false;core.Settings.AreDefaultContextMenusEnabled=false;core.Settings.IsStatusBarEnabled=false;
            core.ServerCertificateErrorDetected+=(s,e)=>{e.Action=Trusted(e.RequestUri)&&CleanPem(e.ServerCertificate.ToPemEncoding())==certificate?CoreWebView2ServerCertificateErrorAction.AlwaysAllow:CoreWebView2ServerCertificateErrorAction.Cancel;};
            core.NavigationStarting+=(s,e)=>{if(!Trusted(e.Uri)){e.Cancel=true;External(e.Uri);return;}offline.Visible=false;chromeReady=false;titlebar.Visible=false;};
            core.NewWindowRequested+=(s,e)=>{e.Handled=true;if(Trusted(e.Uri))core.Navigate(e.Uri);else External(e.Uri);};
            core.NavigationCompleted+=(s,e)=>{if(!e.IsSuccess&&e.WebErrorStatus!=CoreWebView2WebErrorStatus.OperationCanceled){offline.Visible=true;offline.BringToFront();titlebar.Visible=true;titlebar.BringToFront();PresentWindow();}};
            core.ProcessFailed+=(s,e)=>{rendererFailed=true;offline.Visible=true;offline.BringToFront();titlebar.Visible=true;titlebar.BringToFront();PresentWindow();};
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
                case "presentWindow":PresentWindow();value=true;break;
                case "windowReady":chromeReady=true;titlebar.Visible=false;value=new {maximized=WindowState==FormWindowState.Maximized};break;
                case "windowMinimize":Minimize();value=true;break;
                case "windowMotion":nativeMotion=input is bool&&(bool)input;UpdateWindowMotion();value=true;break;
                case "windowMaximize":Maximize();value=true;break;
                case "windowClose":BeginInvoke(new Action(Close));value=true;break;
                case "windowDrag":BeginInvoke(new Action(()=>{ReleaseCapture();SendMessage(Handle,0xA1,new IntPtr(2),IntPtr.Zero);}));value=true;break;
                case "windowResize":
                    var hits=new Dictionary<string,int>{{"w",10},{"e",11},{"n",12},{"nw",13},{"ne",14},{"s",15},{"sw",16},{"se",17}};
                    int hit;if(!hits.TryGetValue(Convert.ToString(input)??"",out hit))throw new Exception("无效的窗口边缘");
                    if(WindowState==FormWindowState.Normal)BeginInvoke(new Action(()=>{ReleaseCapture();SendMessage(Handle,0xA1,new IntPtr(hit),IntPtr.Zero);}));value=true;break;
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
