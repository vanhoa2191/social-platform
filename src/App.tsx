import { lazy, Suspense, useMemo, useState } from 'react'
import './App.css'
import RuntimeCard from './components/RuntimeCard'
import ReviewQueuePanel from './components/ReviewQueuePanel'
import AiGatewayPanel from './components/AiGatewayPanel'
import SchedulerPanel from './components/SchedulerPanel'
import RuntimeLogsPanel from './components/RuntimeLogsPanel'
import PlatformContextPanel from './components/PlatformContextPanel'
import PilotReadinessPanel from './components/PilotReadinessPanel'
import CampaignWizard from './components/CampaignWizard'
import AnalyticsPanel from './components/AnalyticsPanel'

const BackendPanel = lazy(() => import('./components/BackendPanel'))
const AiProfilesPanel = lazy(() => import('./components/AiProfilesPanel'))
const ContentLibraryPanel = lazy(() => import('./components/ContentLibraryPanel'))

type NavKey = 'overview'|'campaigns'|'profiles'|'ai'|'content'|'schedule'|'queue'|'logs'|'analytics'|'settings'

const navItems:{key:NavKey;label:string;icon:string}[]=[
{key:'overview',label:'Tổng quan',icon:'⌂'},{key:'campaigns',label:'Workflow',icon:'◫'},{key:'profiles',label:'Tài khoản & Profile',icon:'◉'},{key:'ai',label:'AI & Nội dung',icon:'✦'},{key:'content',label:'Kho nội dung',icon:'▤'},{key:'schedule',label:'Lịch chạy',icon:'□'},{key:'queue',label:'Hàng đợi',icon:'≡'},{key:'logs',label:'Nhật ký',icon:'≣'},{key:'analytics',label:'Thống kê',icon:'⌁'},{key:'settings',label:'Cài đặt',icon:'⚙'}]
function PageTitle({title,subtitle,action}:{title:string;subtitle:string;action?:React.ReactNode}){return <div className="page-title"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>}

function Shell({active,setActive,children}:{active:NavKey;setActive:(v:NavKey)=>void;children:React.ReactNode}){
return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">⚡</div><div><strong>AutoTool</strong><span>{typeof chrome !== 'undefined' && chrome.runtime?.id ? chrome.runtime.getManifest().version_name ?? chrome.runtime.getManifest().version : '0.14.0-beta'}</span></div></div><nav>{navItems.map(item=><button key={item.key} className={active===item.key?'active':''} onClick={()=>setActive(item.key)}><span className="nav-icon">{item.icon}</span><span>{item.label}</span></button>)}</nav><div className="sidebar-card"><div className="sidebar-card-head"><span>Runtime</span><strong>Beta</strong></div><div className="meter"><span style={{width:'100%'}}/></div><small>Local-first · manual submit</small><button className="soft-btn">Pilot safeguards</button></div><div className="profile-mini"><div className="avatar">VA</div><div><strong>Local user</strong><span>Extension</span></div><span>⌄</span></div></aside><main className="main"><header className="topbar"><div className="breadcrumb">Social Platform / <strong>{navItems.find(n=>n.key===active)?.label}</strong></div><div className="top-actions"><button className="icon-btn">?</button><button className="icon-btn">🔔</button><button className="user-pill"><span className="avatar small">VA</span> Local user ⌄</button></div></header><div className="page">{children}</div></main></div>}

function Overview({createCampaign}:{createCampaign:()=>void}){return <><PageTitle title="AutoTool beta" subtitle="Runtime thật: Feed → AI draft → duyệt thủ công → chuẩn bị comment; final submit vẫn do người dùng bấm trên Facebook." action={<button className="primary" onClick={createCampaign}>＋ Tạo workflow pilot</button>}/><RuntimeCard/><div className="dashboard-grid bottom"><section className="panel"><div className="panel-head"><div><h3>Workflow được hỗ trợ</h3><p>Chỉ bật các bước đã có runtime và test.</p></div><span className="type-pill">beta</span></div><div className="context-policy-grid"><div><strong>Scan</strong><span>Đọc Feed đang hiển thị.</span></div><div><strong>Draft</strong><span>AI tạo nháp có cấu trúc.</span></div><div><strong>Review</strong><span>Người dùng duyệt và chỉnh sửa.</span></div><div><strong>Prepare</strong><span>Điền đúng snapshot đã duyệt, không tự gửi.</span></div></div></section></div></>}

function Campaigns({createCampaign}:{createCampaign:()=>void}){return <><PageTitle title="Workflow pilot" subtitle="Campaign orchestration mở rộng chưa được bật trong beta." action={<button className="primary" onClick={createCampaign}>＋ Tạo workflow pilot</button>}/><section className="panel"><div className="context-policy-grid"><div><strong>Feed</strong><span>Nguồn đang hỗ trợ.</span></div><div><strong>AI draft</strong><span>Insight / Question / Clarification.</span></div><div><strong>Human review</strong><span>Bắt buộc.</span></div><div><strong>Manual submit</strong><span>AutoTool không tự bấm Gửi.</span></div></div><div className="runtime-note">Like, reaction, share, group/page automation và tự động đăng bài chưa được mở trong v0.14 beta.</div></section></>}

function Profiles(){return <><PageTitle title="Tài khoản & Profile" subtitle="Context thật từ tab Facebook đang mở. Scheduler chỉ bind khi account context đã được xác minh."/><PlatformContextPanel/><section className="panel"><div className="panel-head"><div><h3>Nguyên tắc cô lập account</h3><p>Extension không tự suy đoán hoặc chuyển account. Mỗi job và lịch phải khớp context key trước khi chạy.</p></div></div><div className="context-policy-grid"><div><strong>1. Detect</strong><span>Adapter đọc bằng chứng từ DOM và URL profile.</span></div><div><strong>2. Bind</strong><span>Scheduler lưu context key của account đang mở.</span></div><div><strong>3. Verify</strong><span>Trước khi scan/prepare, runtime tìm đúng tab có cùng context key.</span></div><div><strong>4. Lock</strong><span>Queue khóa tài nguyên theo account để tránh đụng tác vụ.</span></div></div></section></>}

function AIProfiles(){return <><PageTitle title="AI & Nội dung" subtitle="Hồ sơ AI Firebase và AI Gateway."/><Suspense fallback={<section className="panel"><div className="runtime-note">Đang tải hồ sơ AI…</div></section>}><AiProfilesPanel/></Suspense><AiGatewayPanel/></>}

function Queue(){return <><PageTitle title="Hàng đợi & Duyệt AI" subtitle="Quét bài, duyệt nội dung AI và theo dõi từng bước trước khi đưa nội dung sang Facebook."/><ReviewQueuePanel/></>}

function Schedule(){return <><PageTitle title="Lịch chạy" subtitle="Lịch thật cho workflow quét Feed → tạo nháp → chờ duyệt. Không tự gửi tương tác."/><SchedulerPanel/></>}

function Analytics(){return <><PageTitle title="Thống kê & Báo cáo" subtitle="Tổng hợp các trạng thái và runtime events có thật."/><AnalyticsPanel/></>}

function Settings(){return <><PageTitle title="Cài đặt" subtitle="Pilot readiness, backend, đồng bộ, giới hạn hoạt động và nguyên tắc bảo mật."/><PilotReadinessPanel/><Suspense fallback={<section className="panel"><div className="runtime-note">Đang tải Backend & Sync…</div></section>}><BackendPanel/></Suspense><div className="dashboard-grid bottom"><section className="panel"><div className="panel-head"><div><h3>Dữ liệu local-first</h3><p>Các trạng thái thực thi không phụ thuộc mạng.</p></div></div><div className="context-policy-grid"><div><strong>Queue & locks</strong><span>Luôn lưu cục bộ trong IndexedDB của extension.</span></div><div><strong>Review candidates</strong><span>Không tự đẩy nội dung nhạy cảm lên cloud.</span></div><div><strong>Schedules</strong><span>Cloud lưu định nghĩa; browser local là nguồn thực thi.</span></div><div><strong>Telemetry</strong><span>Mặc định tắt; chỉ gửi metadata chuẩn hóa sau khi opt-in.</span></div></div></section><section className="panel"><div className="panel-head"><div><h3>Nguyên tắc bảo mật</h3><p>Không đặt secret/service-role key trong extension.</p></div></div><div className="provider-list"><div><b>Firebase</b><span>Web config công khai</span><em>Security Rules bắt buộc</em></div><div><b>Auth</b><span>User JWT</span><em>Per-user access</em></div><div><b>AI</b><span>Provider API key</span><em>Gateway server-side</em></div></div></section></div></>}

function ContentLibrary(){return <><PageTitle title="Kho nội dung" subtitle="CRUD template, prompt và note trên Firebase."/><Suspense fallback={<section className="panel"><div className="runtime-note">Đang tải kho nội dung…</div></section>}><ContentLibraryPanel/></Suspense></>}

function Logs(){return <><PageTitle title="Nhật ký runtime" subtitle="Event thật từ scheduler, queue, review engine và hệ thống."/><RuntimeLogsPanel/></>}

function App(){const[active,setActive]=useState<NavKey>('overview');const[wizard,setWizard]=useState(false);const page=useMemo(()=>{switch(active){case'overview':return <Overview createCampaign={()=>setWizard(true)}/>;case'campaigns':return <Campaigns createCampaign={()=>setWizard(true)}/>;case'profiles':return <Profiles/>;case'ai':return <AIProfiles/>;case'content':return <ContentLibrary/>;case'schedule':return <Schedule/>;case'queue':return <Queue/>;case'logs':return <Logs/>;case'analytics':return <Analytics/>;case'settings':return <Settings/>}},[active]);return <Shell active={active} setActive={setActive}>{page}{wizard&&<CampaignWizard close={()=>setWizard(false)}/>}</Shell>}
export default App
