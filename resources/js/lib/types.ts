// 화면에서 쓰는 데이터 모양 (서버 /api/state 응답과 같다)

export interface Activity {
    id: string; type: string; date: string; purpose?: string; contact?: string; reaction?: string; note?: string; authorId?: string;
    voc?: { type: string; text: string }; comp?: { competitorId: string; text: string }; issue?: { type: string; text: string };
}
export interface Eval { adoption?: number | ''; favor?: number | ''; surgeries?: number | ''; surgeryCount?: number | ''; date?: string; scale?: number }
export interface Next { date?: string; todo?: string; done?: boolean }
export interface StageMove { date: string; from: string; to: string }
export interface Hospital {
    id: string; name: string; zip: string; address: string; jibun: string; addressDetail: string; sido: string; sigungu: string;
    lat: number | null; lng: number | null; grade: string; specialty: string; phone: string; director: string; directorPhone: string;
    vetCount: number | ''; ownerId: string; categoryIds: string[]; compId?: string; compUntil?: string; pre?: string; sources?: string[];
    stage: string; stageHistory: StageMove[]; eval: Eval; activities: Activity[]; next: Next;
    signupDate: string; usageCount: number; lastUsedDate: string; memo: string;
    createdAt: string; createdBy: string; deletedAt?: string; deletedBy?: string;
    /** 영업 상태 (없으면 영업) · 폐업일 · 인허가 관리번호 · 가져온 경로(file|api) */
    bizStatus?: '' | '영업' | '휴업' | '폐업'; closedAt?: string; bizDetail?: string; srcUpdatedAt?: string; extId?: string; importedFrom?: '' | 'file' | 'api';
}
export interface User { id: string; username: string; name: string; team?: string; phone?: string; roleId: string; status: 'active' | 'inactive' | 'pending'; slot?: number; annualLeave?: number; joinedAt?: string }
export interface Role { id: string; name: string; desc?: string; scope: 'all' | 'own'; locked?: boolean; perms: Record<string, Record<string, boolean>> }
export interface Category { id: string; name: string; desc?: string; color: string }
export interface Stage { id: string; name: string; kind: 'main' | 'exit'; trigger: string; color: string }
export interface Change { field: string; before: string; after: string }
export interface AuditEntry {
    id: string; ts: string; userId: string; userName: string; roleName: string; entity: string; entityId?: string; hospitalId?: string;
    targetName?: string; action: string; section?: string; changes?: Change[]; summary?: string;
}
export interface Report {
    id: string; authorId: string; date: string; status: string; workType: string; region: string; mileage: number | ''; highlights: string;
    voc: any[]; comp: any[]; issues: any[]; plan: { hospitalIds: string[]; goal: number | ''; note: string }; exp: any[]; memo: string;
    goal?: number; stats?: any; acts?: any[]; submittedAt?: string; reviewerId?: string; reviewedAt?: string; reviewComment?: string;
}
export interface Attendance { id: string; userId: string; type: string; from: string; to: string; reason: string; status: string; requestedBy: string; requestedAt: string; approverId?: string; approvedAt?: string; comment?: string }
export interface Competitor { id: string; name: string; company?: string; type?: string; threat?: string; website?: string; phone?: string; zip?: string; address?: string; jibun?: string; addressDetail?: string; sido?: string; sigungu?: string; lat?: number | null; lng?: number | null; regions?: string; products?: { name: string; price: string; note: string }[]; strengths?: string; weaknesses?: string; counter?: string; memo?: string; createdAt?: string; createdBy?: string; [k: string]: any }
export interface Todo { id: string; userId: string; date: string; text: string; done: boolean; doneAt?: string }
export interface Coaching { id: string; userId: string; authorId: string; authorName: string; ts: string; text: string; readAt?: string }
export interface Settings { visitGoal: number; mapProvider: 'kakao' | 'naver'; requiredFields: string[] }
export interface PublicApiConfig { url: string; params: string; rows: number; hasKey: boolean; keyTail: string; last?: { at: string; by: string; summary: string } | null }
export interface MapViewF { cats: string[]; stages: string[]; biz: string[]; sido: string; sigungu: string; owner: string; info: string; grade: string }
export interface MapView { id: string; name: string; f: MapViewF }
export interface Maps { provider: 'kakao' | 'naver'; kakaoKey: string; naverKey: string }

export interface State {
    seq: number; session: string;
    categories: Category[]; codes: { grades: string[]; specialties: string[]; teams: string[] }; settings: Settings; maps: Maps;
    stages: Stage[]; holidays: Record<string, string>; attendance: Attendance[]; roles: Role[]; users: User[];
    geocoder: '' | 'kakao' | 'naver'; publicApi: PublicApiConfig | null; mapViews: MapView[]; myRoute?: { date: string; ids: string[]; at: string } | null;
    hospitals: Hospital[]; audit: AuditEntry[]; reports: Report[]; competitors: Competitor[]; todos: Todo[]; coaching: Coaching[];
}
