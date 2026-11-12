import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import {prepare,root} from './prepare-apps.mjs';
const config=prepare(),stage=path.join(root,'.build/windows-webview2'),release=path.join(root,'release'),sdk=process.env.WEBVIEW2_SDK||path.resolve(root,'../../validation/webview2-sdk');
fs.mkdirSync(stage,{recursive:true});fs.mkdirSync(release,{recursive:true});
for(const name of ['product.json','icon.ico','bridge.js',config.certificate])fs.copyFileSync(path.join(root,'frontend/windows',name),path.join(stage,name));
for(const name of ['Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.WinForms.dll'])fs.copyFileSync(path.join(sdk,'lib/net462',name),path.join(stage,name));
fs.copyFileSync(path.join(sdk,'runtimes/win-x64/native/WebView2Loader.dll'),path.join(stage,'WebView2Loader.dll'));
const compile=spawnSync('C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe',['/nologo','/target:winexe','/platform:x64','/optimize+','/out:'+path.join(stage,'CoreNyan.exe'),'/win32icon:'+path.join(root,'frontend/windows/icon.ico'),'/win32manifest:'+path.join(root,'frontend/windows/app.manifest'),'/reference:System.Windows.Forms.dll','/reference:System.Drawing.dll','/reference:System.Web.Extensions.dll','/reference:'+path.join(stage,'Microsoft.Web.WebView2.Core.dll'),'/reference:'+path.join(stage,'Microsoft.Web.WebView2.WinForms.dll'),path.join(root,'frontend/windows/MatrixShell.cs')],{stdio:'inherit'});if(compile.status)throw Error('Native shell compilation failed');
fs.writeFileSync(path.join(stage,'CoreNyan.exe.config'),'<?xml version="1.0"?><configuration><startup><supportedRuntime version="v4.0" sku=".NETFramework,Version=v4.8" /></startup></configuration>');
const legacy=JSON.parse(fs.readFileSync(path.join(root,'frontend/windows/legacy-electron-files.json'),'utf8'));if(legacy.some(p=>p.includes('..')||p.startsWith('/')||p.includes(':')))throw Error('Invalid legacy runtime path');
const cleanup=legacy.map(p=>'Type: files; Name: "{app}\\'+p.replaceAll('/','\\')+'"').join('\n');
const script=path.join(root,'.build/windows-beta.iss'),base=config.name+'-'+config.version+'-windows-x64-setup';
fs.writeFileSync(script,`[Setup]
AppId={{C621767C-A669-4871-B72D-44D654647C74}
AppName=CoreNyan
AppVersion=${config.version}
AppPublisher=CoreNyan
DefaultDirName={localappdata}\\Programs\\CoreNyan
DefaultGroupName=CoreNyan
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=${release}
OutputBaseFilename=${base}
SetupIconFile=${path.join(root,'frontend/windows/icon.ico')}
UninstallDisplayIcon={app}\\CoreNyan.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
[InstallDelete]
${cleanup}
[Languages]
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\\ChineseSimplified.isl"
[Files]
Source: "${stage}\\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{group}\\CoreNyan"; Filename: "{app}\\CoreNyan.exe"; IconFilename: "{app}\\icon.ico"
Name: "{autodesktop}\\CoreNyan"; Filename: "{app}\\CoreNyan.exe"; IconFilename: "{app}\\icon.ico"
[Run]
Filename: "{app}\\CoreNyan.exe"; Description: "启动 CoreNyan"; Flags: nowait postinstall skipifsilent
`);
const result=spawnSync(process.env.ISCC||'D:/Inno Setup 6/ISCC.exe',[script],{stdio:'inherit'});if(result.status)throw Error('Installer build failed');const out=path.join(release,base+'.exe');fs.writeFileSync(out+'.sha256',createHash('sha256').update(fs.readFileSync(out)).digest('hex')+'  '+path.basename(out)+'\n');console.log('Windows Beta package: '+out);
