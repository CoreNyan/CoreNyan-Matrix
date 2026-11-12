export const NOTIFICATIONS=Object.freeze({api:'/api/notifications',saveMs:800,pollMs:15000,testCooldownMs:30000,maxConcurrent:3,smtpTimeoutMs:20000,subject:'CoreNyan · 小可回复了你',testTitle:'CoreNyan · 通知测试',testBody:'收到啦！小可的通知可以送到这里了 (๑•̀ㅂ•́)و✧',providers:[
 {id:'qq',name:'QQ 邮箱',host:'smtp.qq.com',port:465,security:'tls',hint:'在邮箱设置中开启 SMTP，使用授权码。'},
 {id:'163',name:'网易 163',host:'smtp.163.com',port:465,security:'tls',hint:'开启 SMTP 服务后填写客户端授权码。'},
 {id:'126',name:'网易 126',host:'smtp.126.com',port:465,security:'tls',hint:'开启 SMTP 服务后填写客户端授权码。'},
 {id:'gmail',name:'Gmail',host:'smtp.gmail.com',port:465,security:'tls',hint:'使用应用专用密码，或配置 OAuth2。',tokenUrl:'https://oauth2.googleapis.com/token'},
 {id:'outlook',name:'Outlook / Microsoft 365',host:'smtp.office365.com',port:587,security:'starttls',hint:'需启用 SMTP AUTH；不支持密码登录的账号请选择 OAuth2。',tokenUrl:'https://login.microsoftonline.com/common/oauth2/v2.0/token'},
 {id:'icloud',name:'iCloud',host:'smtp.mail.me.com',port:587,security:'starttls',hint:'使用 Apple 账户生成的 App 专用密码。'},
 {id:'yahoo',name:'Yahoo',host:'smtp.mail.yahoo.com',port:465,security:'tls',hint:'使用邮箱生成的应用密码。'},
 {id:'custom',name:'其他邮箱 / 自定义 SMTP',host:'',port:465,security:'tls',hint:'填写邮箱服务商提供的 SMTP 地址与凭据。'}
]});
export const DEFAULT_EMAIL=Object.freeze({enabled:false,provider:'qq',host:'smtp.qq.com',port:465,security:'tls',user:'',from:'',to:'',authMode:'password',password:'',clientId:'',clientSecret:'',refreshToken:'',accessToken:'',tokenUrl:'https://oauth2.googleapis.com/token'});
export const MAIL_SECRETS=Object.freeze(['password','clientSecret','refreshToken','accessToken']);
