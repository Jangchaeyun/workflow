/**
 * 데모/개발용 시드 데이터.
 *
 * 대시보드와 통계 화면이 의미 있게 보이도록 최근 12개월에 걸쳐
 * 수주·상담·업무 이력을 분포시킨다. 결과 재현이 가능해야 스크린샷과 문서가
 * 어긋나지 않으므로 Math.random 대신 고정 시드 PRNG를 사용한다.
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

import { DEFAULT_ROLE_PERMISSIONS, ALL_PERMISSIONS } from '../src/lib/permissions';
import { ROLES, DEAL_STAGE_PROBABILITY, type DealStage } from '../src/lib/constants';

const prisma = new PrismaClient();

// --- 고정 시드 PRNG ---------------------------------------------------------

let seedState = 20_240_601;
function random(): number {
  seedState = (seedState * 1_103_515_245 + 12_345) % 2_147_483_648;
  return seedState / 2_147_483_648;
}
function randomInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}
function chance(probability: number): boolean {
  return random() < probability;
}
function daysFromNow(days: number, hour = 10): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, randomInt(0, 59), 0, 0);
  return date;
}

const AVATAR_COLORS = [
  '#4f46e5',
  '#0891b2',
  '#059669',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#db2777',
  '#0d9488',
];

async function main() {
  console.log('▶ 기존 데이터 정리...');
  // 외래키 제약을 피하려면 자식 → 부모 순서로 지운다.
  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.taskWatcher.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.consultation.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.client.deleteMany();
  await prisma.salesTarget.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();

  // --- 부서 ----------------------------------------------------------------
  console.log('▶ 부서 생성...');
  const departmentSeed = [
    { name: '경영지원팀', code: 'MGMT', description: '인사·재무·총무', costCenter: 'CC-100' },
    { name: '영업1팀', code: 'SALES1', description: '수도권 신규 영업', costCenter: 'CC-200' },
    { name: '영업2팀', code: 'SALES2', description: '지방·기존 거래처 관리', costCenter: 'CC-210' },
    { name: '기술지원팀', code: 'TECH', description: '설치·유지보수·CS', costCenter: 'CC-300' },
    { name: '개발팀', code: 'DEV', description: '솔루션 개발', costCenter: 'CC-400' },
  ];
  const departments = await Promise.all(
    departmentSeed.map((data) => prisma.department.create({ data })),
  );
  const deptByCode = new Map(departments.map((d) => [d.code, d]));

  // --- 계정 ----------------------------------------------------------------
  console.log('▶ 직원 계정 생성...');
  const password = await bcrypt.hash('workflow123', 10);

  const userSeed = [
    { email: 'admin@workflow.co.kr', name: '정하늘', role: 'ADMIN', dept: 'MGMT', position: '경영지원실장', status: 'ACTIVE' },
    { email: 'manager.sales@workflow.co.kr', name: '김도현', role: 'MANAGER', dept: 'SALES1', position: '영업1팀장', status: 'ACTIVE' },
    { email: 'manager.tech@workflow.co.kr', name: '오세훈', role: 'MANAGER', dept: 'TECH', position: '기술지원팀장', status: 'ACTIVE' },
    { email: 'sales1@workflow.co.kr', name: '박지민', role: 'SALES', dept: 'SALES1', position: '대리', status: 'ACTIVE' },
    { email: 'sales2@workflow.co.kr', name: '이수현', role: 'SALES', dept: 'SALES1', position: '사원', status: 'ACTIVE' },
    { email: 'sales3@workflow.co.kr', name: '최민재', role: 'SALES', dept: 'SALES2', position: '과장', status: 'ACTIVE' },
    { email: 'sales4@workflow.co.kr', name: '한소영', role: 'SALES', dept: 'SALES2', position: '대리', status: 'ACTIVE' },
    { email: 'staff1@workflow.co.kr', name: '윤재호', role: 'EMPLOYEE', dept: 'TECH', position: '주임', status: 'ACTIVE' },
    { email: 'staff2@workflow.co.kr', name: '강예린', role: 'EMPLOYEE', dept: 'TECH', position: '사원', status: 'ACTIVE' },
    { email: 'staff3@workflow.co.kr', name: '임태윤', role: 'EMPLOYEE', dept: 'DEV', position: '선임연구원', status: 'ACTIVE' },
    { email: 'staff4@workflow.co.kr', name: '서다은', role: 'EMPLOYEE', dept: 'DEV', position: '연구원', status: 'ACTIVE' },
    { email: 'staff5@workflow.co.kr', name: '노현우', role: 'EMPLOYEE', dept: 'MGMT', position: '사원', status: 'ACTIVE' },
    { email: 'pending1@workflow.co.kr', name: '조은비', role: 'EMPLOYEE', dept: 'TECH', position: '사원', status: 'PENDING' },
    { email: 'pending2@workflow.co.kr', name: '배성민', role: 'SALES', dept: 'SALES2', position: '사원', status: 'PENDING' },
    { email: 'suspended1@workflow.co.kr', name: '문지훈', role: 'EMPLOYEE', dept: 'DEV', position: '사원', status: 'SUSPENDED' },
  ] as const;

  const users = [];
  for (const [index, data] of userSeed.entries()) {
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password,
        name: data.name,
        role: data.role,
        status: data.status,
        employeeNo: `2024-${String(index + 1).padStart(3, '0')}`,
        position: data.position,
        phone: `010-${randomInt(2000, 9999)}-${randomInt(1000, 9999)}`,
        hireDate: daysFromNow(-randomInt(120, 2200), 9),
        avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
        departmentId: deptByCode.get(data.dept)!.id,
        lastLoginAt: data.status === 'ACTIVE' ? daysFromNow(-randomInt(0, 6), randomInt(8, 19)) : null,
      },
    });
    users.push(user);
  }

  const admin = users[0];
  const salesManager = users[1];
  const techManager = users[2];
  const salesUsers = users.filter((u) => u.role === 'SALES' && u.status === 'ACTIVE');
  const activeUsers = users.filter((u) => u.status === 'ACTIVE');
  const workerUsers = activeUsers.filter((u) => u.role !== 'ADMIN');

  // 보고 라인 연결
  for (const user of users) {
    if (user.id === admin.id) continue;
    const managerId =
      user.role === 'MANAGER'
        ? admin.id
        : user.departmentId === salesManager.departmentId ||
            user.departmentId === deptByCode.get('SALES2')!.id
          ? salesManager.id
          : user.departmentId === deptByCode.get('MGMT')!.id
            ? admin.id
            : techManager.id;
    await prisma.user.update({ where: { id: user.id }, data: { managerId } });
  }

  // --- 권한 매트릭스 -------------------------------------------------------
  console.log('▶ 역할별 권한 매트릭스 생성...');
  await prisma.rolePermission.createMany({
    data: ROLES.flatMap((role) =>
      ALL_PERMISSIONS.map((permission) => ({
        role,
        permission,
        allowed: DEFAULT_ROLE_PERMISSIONS[role].includes(permission),
      })),
    ),
  });

  // --- 거래처 --------------------------------------------------------------
  console.log('▶ 거래처 생성...');
  const clientSeed = [
    { name: '(주)대한정밀', industry: '기계부품 제조', scale: 'MID', region: '경기 화성시' },
    { name: '서울테크놀로지(주)', industry: '전자부품', scale: 'SMALL', region: '서울 금천구' },
    { name: '(주)한빛소재', industry: '화학소재', scale: 'MID', region: '충남 아산시' },
    { name: '코스모물류(주)', industry: '물류·운송', scale: 'SMALL', region: '인천 중구' },
    { name: '(주)미래에너지', industry: '신재생에너지', scale: 'MID', region: '전남 나주시' },
    { name: '청우식품(주)', industry: '식품 제조', scale: 'SMALL', region: '경기 이천시' },
    { name: '(주)네오시스템즈', industry: 'SI·솔루션', scale: 'SMALL', region: '서울 강남구' },
    { name: '광명산업(주)', industry: '금속가공', scale: 'SMALL', region: '경기 광명시' },
    { name: '(주)그린바이오', industry: '바이오', scale: 'STARTUP', region: '대전 유성구' },
    { name: '태산건설(주)', industry: '건설', scale: 'LARGE', region: '서울 서초구' },
    { name: '(주)엘리트교육', industry: '교육서비스', scale: 'SMALL', region: '서울 노원구' },
    { name: '우리메디칼(주)', industry: '의료기기', scale: 'MID', region: '경기 성남시' },
    { name: '(주)스마트팜코리아', industry: '스마트팜', scale: 'STARTUP', region: '전북 김제시' },
    { name: '한강물산(주)', industry: '유통', scale: 'SMALL', region: '서울 송파구' },
    { name: '(주)디자인하우스', industry: '디자인·광고', scale: 'STARTUP', region: '서울 마포구' },
    { name: '성진화학(주)', industry: '화학', scale: 'MID', region: '울산 남구' },
    { name: '(주)오션로지스', industry: '해운', scale: 'MID', region: '부산 중구' },
    { name: '케이패션(주)', industry: '의류', scale: 'SMALL', region: '서울 중구' },
    { name: '(주)블루칩투자자문', industry: '금융서비스', scale: 'SMALL', region: '서울 영등포구' },
    { name: '남부전기(주)', industry: '전기설비', scale: 'SMALL', region: '광주 광산구' },
    { name: '(주)클라우드메이트', industry: 'IT서비스', scale: 'STARTUP', region: '서울 성동구' },
    { name: '삼정기계(주)', industry: '산업기계', scale: 'MID', region: '경남 창원시' },
    { name: '(주)헬스케어원', industry: '헬스케어', scale: 'SMALL', region: '경기 고양시' },
    { name: '동방유통(주)', industry: '식자재 유통', scale: 'SMALL', region: '대구 달서구' },
  ] as const;

  const surnames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권'];
  const givenNames = ['민준', '서연', '지호', '수빈', '예준', '하윤', '도윤', '지우', '건우', '유진', '준서', '채원', '현우', '다인', '성호'];
  const contactPositions = ['대표이사', '구매팀장', '생산본부장', '기획팀 과장', 'IT팀 대리', '총무팀장', '영업이사', '품질관리 차장'];
  const contactDepartments = ['구매팀', '생산팀', '기획팀', 'IT팀', '총무팀', '영업팀', '품질관리팀'];

  const clients = [];
  for (const [index, data] of clientSeed.entries()) {
    const status = index < 14 ? 'ACTIVE' : index < 20 ? 'PROSPECT' : index < 22 ? 'DORMANT' : 'CHURNED';
    const client = await prisma.client.create({
      data: {
        code: `CL-${String(index + 1).padStart(4, '0')}`,
        name: data.name,
        businessNo: `${randomInt(100, 899)}-${randomInt(10, 99)}-${randomInt(10000, 99999)}`,
        ceoName: `${pick(surnames)}${pick(givenNames)}`,
        industry: data.industry,
        scale: data.scale,
        grade: status === 'ACTIVE' ? pick(['A', 'A', 'B', 'B', 'C']) : pick(['B', 'C', 'C', 'D']),
        status,
        phone: `0${randomInt(2, 6)}-${randomInt(200, 999)}-${randomInt(1000, 9999)}`,
        email: `contact${index + 1}@example.co.kr`,
        website: `https://www.example${index + 1}.co.kr`,
        address: `${data.region} 산업로 ${randomInt(1, 320)}`,
        memo: status === 'CHURNED' ? '단가 이슈로 거래 중단. 재접촉 시 가격 정책 확인 필요.' : null,
        ownerId: pick(salesUsers).id,
        createdAt: daysFromNow(-randomInt(30, 700), 11),
      },
    });
    clients.push(client);

    const contactCount = randomInt(1, 3);
    for (let c = 0; c < contactCount; c += 1) {
      await prisma.contact.create({
        data: {
          clientId: client.id,
          name: `${pick(surnames)}${pick(givenNames)}`,
          department: pick(contactDepartments),
          position: pick(contactPositions),
          phone: `0${randomInt(2, 6)}-${randomInt(200, 999)}-${randomInt(1000, 9999)}`,
          mobile: `010-${randomInt(2000, 9999)}-${randomInt(1000, 9999)}`,
          email: `person${index + 1}${c + 1}@example.co.kr`,
          isPrimary: c === 0,
        },
      });
    }
  }

  const allContacts = await prisma.contact.findMany();
  const contactsByClient = new Map<string, typeof allContacts>();
  for (const contact of allContacts) {
    const bucket = contactsByClient.get(contact.clientId) ?? [];
    bucket.push(contact);
    contactsByClient.set(contact.clientId, bucket);
  }

  // --- 영업 기회 ------------------------------------------------------------
  console.log('▶ 영업 기회 생성...');
  const dealSubjects = [
    'ERP 고도화 1차 구축',
    '생산라인 자동화 설비 공급',
    '스마트팩토리 MES 도입',
    '연간 유지보수 계약 갱신',
    '창고관리 시스템(WMS) 구축',
    '그룹웨어 라이선스 100석 증설',
    '품질검사 장비 교체',
    '전사 보안 솔루션 도입',
    '물류 최적화 컨설팅',
    '모바일 영업지원 앱 개발',
    '데이터 백업 인프라 구축',
    '설비 원격 모니터링 시스템',
    '노후 서버 리플레이스',
    'CRM 커스터마이징',
    '전력 사용량 분석 솔루션',
  ];
  const dealSources = ['기존고객 추천', '전시회', '인바운드 문의', '콜드콜', '파트너사 소개', '온라인 광고'];

  const activeClients = clients.filter((c) => c.status === 'ACTIVE' || c.status === 'PROSPECT');
  const deals = [];

  for (let index = 0; index < 46; index += 1) {
    const client = pick(activeClients);
    const contacts = contactsByClient.get(client.id) ?? [];

    // 절반 이상을 종료 단계로 만들어 매출 추이 그래프가 채워지도록 한다.
    const stage: DealStage =
      index < 20
        ? 'WON'
        : index < 26
          ? 'LOST'
          : pick(['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION'] as const);

    const isClosed = stage === 'WON' || stage === 'LOST';
    const closedAt = isClosed ? daysFromNow(-randomInt(1, 350), 15) : null;
    const amount = randomInt(8, 320) * 1_000_000;

    const deal = await prisma.deal.create({
      data: {
        code: `DL-${String(index + 1).padStart(4, '0')}`,
        title: `${client.name} ${pick(dealSubjects)}`,
        amount,
        stage,
        probability: DEAL_STAGE_PROBABILITY[stage],
        contractStatus:
          stage === 'WON'
            ? 'SIGNED'
            : stage === 'LOST'
              ? 'CANCELLED'
              : stage === 'NEGOTIATION'
                ? pick(['DRAFTING', 'REVIEW'] as const)
                : 'NONE',
        contractStartDate: stage === 'WON' ? closedAt : null,
        contractEndDate: stage === 'WON' ? daysFromNow(randomInt(30, 400), 15) : null,
        expectedCloseDate: isClosed ? closedAt : daysFromNow(randomInt(5, 120), 15),
        closedAt,
        lostReason:
          stage === 'LOST'
            ? pick(['경쟁사 저가 수주', '예산 미확보', '내부 일정 연기', '요구사항 불일치'] as const)
            : null,
        source: pick(dealSources),
        clientId: client.id,
        contactId: contacts.length > 0 ? pick(contacts).id : null,
        ownerId: client.ownerId ?? pick(salesUsers).id,
        createdAt: daysFromNow(-randomInt(20, 400), 10),
      },
    });
    deals.push(deal);
  }

  // --- 상담 기록 -----------------------------------------------------------
  console.log('▶ 상담 기록 생성...');
  const consultationTemplates = [
    { title: '초기 요구사항 청취', content: '현행 업무 프로세스와 병목 구간을 확인했습니다. 수기 관리 중인 재고 대장 전산화 요구가 가장 큽니다.' },
    { title: '견적 및 단가 협의', content: '제시 단가 대비 8% 인하 요청. 유지보수 기간을 1년 연장하는 조건으로 재견적 검토하기로 했습니다.' },
    { title: '기술 검토 미팅', content: '기존 시스템과의 연동 범위를 확정했습니다. API 스펙 문서를 다음 주까지 회신받기로 협의했습니다.' },
    { title: '계약 조건 최종 확인', content: '검수 기준과 하자보수 범위를 조정했습니다. 법무 검토 후 이번 달 내 체결 예정입니다.' },
    { title: '정기 방문 상담', content: '운영 중 불편 사항을 청취했습니다. 리포트 화면 개선 요청이 있어 차기 과제로 등록했습니다.' },
    { title: '경쟁사 제안 대응', content: '경쟁사가 20% 낮은 금액을 제시했습니다. TCO 관점의 비교 자료를 준비해 재방문하기로 했습니다.' },
    { title: '도입 효과 리뷰', content: '도입 6개월 경과 후 재고 오차율이 12%에서 3%로 감소했습니다. 추가 모듈 확장을 제안했습니다.' },
    { title: '장애 대응 후속 상담', content: '지난 주 발생한 동기화 지연 원인을 설명하고 재발 방지 대책을 공유했습니다.' },
  ];
  const nextActions = [
    '수정 견적서 발송',
    '기술 검토 회의 일정 조정',
    '샘플 데모 환경 제공',
    '계약서 초안 송부',
    '담당 임원 미팅 요청',
    '경쟁사 비교 자료 준비',
  ];

  for (let index = 0; index < 96; index += 1) {
    const deal = pick(deals);
    const contacts = contactsByClient.get(deal.clientId) ?? [];
    const template = pick(consultationTemplates);
    const hasNext = chance(0.45);

    await prisma.consultation.create({
      data: {
        type: pick(['PHONE', 'VISIT', 'EMAIL', 'MEETING', 'ONLINE'] as const),
        title: template.title,
        content: template.content,
        result: pick(['POSITIVE', 'POSITIVE', 'NEUTRAL', 'NEUTRAL', 'NEGATIVE'] as const),
        consultedAt: daysFromNow(-randomInt(0, 240), randomInt(9, 18)),
        nextAction: hasNext ? pick(nextActions) : null,
        nextActionAt: hasNext ? daysFromNow(randomInt(1, 21), 14) : null,
        clientId: deal.clientId,
        contactId: contacts.length > 0 ? pick(contacts).id : null,
        dealId: chance(0.75) ? deal.id : null,
        userId: deal.ownerId,
      },
    });
  }

  // --- 업무 ----------------------------------------------------------------
  console.log('▶ 업무 생성...');
  const taskTemplates: { title: string; category: string; description: string }[] = [
    { title: '월간 매출 마감 자료 정리', category: 'GENERAL', description: '전월 매출·수금 현황을 취합해 경영 보고용 자료로 정리합니다.' },
    { title: '신규 거래처 신용조회 요청', category: 'SALES', description: '신규 등록 거래처의 신용평가 등급을 조회하고 여신 한도를 산정합니다.' },
    { title: '제안서 초안 작성', category: 'SALES', description: '고객 요구사항 정의서를 기반으로 제안서 초안과 견적 산출 근거를 작성합니다.' },
    { title: '설치 현장 사전 실사', category: 'SUPPORT', description: '설치 예정 현장의 전원·네트워크 환경을 점검하고 체크리스트를 작성합니다.' },
    { title: '정기 점검 방문 일정 조정', category: 'SUPPORT', description: '분기 정기 점검 대상 고객사와 방문 일정을 협의합니다.' },
    { title: '계약서 법무 검토 요청', category: 'CONTRACT', description: '수정된 계약 조항에 대해 법무 검토를 요청하고 회신 내용을 반영합니다.' },
    { title: '하자보수 범위 확인', category: 'CONTRACT', description: '계약서상 하자보수 조항과 실제 요청 범위의 차이를 정리합니다.' },
    { title: 'API 연동 스펙 정의', category: 'DEVELOP', description: '고객사 기존 시스템과의 연동 인터페이스 규격을 정의하고 문서화합니다.' },
    { title: '리포트 화면 개선 개발', category: 'DEVELOP', description: '요청받은 대시보드 리포트 필터·정렬 기능을 개선합니다.' },
    { title: '배포 전 회귀 테스트', category: 'DEVELOP', description: '릴리스 예정 기능에 대한 회귀 테스트 시나리오를 수행합니다.' },
    { title: '고객 문의 티켓 1차 응대', category: 'CS', description: '접수된 문의 티켓을 분류하고 1차 답변을 발송합니다.' },
    { title: '장애 원인 분석 보고서 작성', category: 'CS', description: '발생 장애의 원인과 조치 내역, 재발 방지 대책을 정리합니다.' },
    { title: '사내 교육 자료 업데이트', category: 'GENERAL', description: '신규 기능 반영해 사내 사용자 교육 자료를 갱신합니다.' },
    { title: '견적 단가표 개정', category: 'SALES', description: '원가 변동을 반영해 표준 견적 단가표를 개정합니다.' },
    { title: '수금 지연 거래처 확인', category: 'GENERAL', description: '입금 예정일이 경과한 거래처를 확인하고 담당 영업에 공유합니다.' },
    { title: '전시회 참가 부스 준비', category: 'SALES', description: '산업 전시회 부스 구성과 배포 자료를 준비합니다.' },
  ];

  const commentTemplates = [
    '거래처 담당자와 통화했습니다. 일정 조정 없이 진행 가능합니다.',
    '요청 자료 수신 완료했습니다. 검토 후 회신드리겠습니다.',
    '내부 검토 결과 추가 리소스가 필요합니다. 일정 재조정 요청드립니다.',
    '1차 작업 완료했습니다. 검토 부탁드립니다.',
    '고객사 사정으로 다음 주로 연기되었습니다.',
    '관련 부서 협의가 끝났습니다. 바로 진행하겠습니다.',
    '누락된 항목이 있어 보완했습니다.',
  ];

  const tasks = [];
  for (let index = 0; index < 104; index += 1) {
    const template = pick(taskTemplates);
    const assignee = pick(workerUsers);
    const reporter = pick([admin, salesManager, techManager, ...workerUsers]);
    const client = chance(0.7) ? pick(clients) : null;
    const relatedDeal =
      client && chance(0.4) ? deals.find((deal) => deal.clientId === client.id) ?? null : null;

    // 최근 8주에 걸쳐 분포시키고, 일부는 마감 초과 상태로 만들어 지연 알림이 보이게 한다.
    const createdOffset = -randomInt(0, 56);
    const status =
      index < 52 ? 'DONE' : index < 74 ? 'IN_PROGRESS' : index < 86 ? 'TODO' : index < 96 ? 'REVIEW' : 'HOLD';
    const dueOffset = status === 'DONE' ? createdOffset + randomInt(1, 14) : randomInt(-9, 30);

    const priority =
      status === 'HOLD' ? 'LOW' : pick(['LOW', 'MEDIUM', 'MEDIUM', 'HIGH', 'HIGH', 'URGENT'] as const);

    const progress =
      status === 'DONE' ? 100 : status === 'REVIEW' ? randomInt(80, 95) : status === 'IN_PROGRESS' ? randomInt(20, 75) : 0;

    const task = await prisma.task.create({
      data: {
        code: `TSK-${String(index + 1).padStart(4, '0')}`,
        title: client ? `[${client.name}] ${template.title}` : template.title,
        description: template.description,
        status,
        priority,
        category: template.category,
        progress,
        startDate: daysFromNow(createdOffset, 9),
        dueDate: daysFromNow(dueOffset, 18),
        completedAt: status === 'DONE' ? daysFromNow(dueOffset - randomInt(0, 3), 17) : null,
        estimatedHours: randomInt(2, 40),
        actualHours: status === 'DONE' ? randomInt(2, 48) : null,
        assigneeId: assignee.id,
        reporterId: reporter.id,
        clientId: client?.id ?? null,
        dealId: relatedDeal?.id ?? null,
        createdAt: daysFromNow(createdOffset, 9),
      },
    });
    tasks.push(task);

    for (let c = 0; c < randomInt(0, 3); c += 1) {
      await prisma.taskComment.create({
        data: {
          taskId: task.id,
          userId: pick([assignee, reporter]).id,
          content: pick(commentTemplates),
          createdAt: daysFromNow(createdOffset + randomInt(0, 5), randomInt(9, 18)),
        },
      });
    }

    if (chance(0.3)) {
      await prisma.taskWatcher.create({
        data: { taskId: task.id, userId: reporter.id === assignee.id ? admin.id : reporter.id },
      }).catch(() => undefined);
    }
  }

  // --- 매출 목표 -----------------------------------------------------------
  console.log('▶ 매출 목표 생성...');
  const now = new Date();
  const targetRows: { year: number; month: number; targetAmount: number; userId: string | null; departmentId: string | null }[] = [];

  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    for (const user of salesUsers) {
      targetRows.push({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        targetAmount: randomInt(120, 260) * 1_000_000,
        userId: user.id,
        departmentId: null,
      });
    }
  }
  await prisma.salesTarget.createMany({ data: targetRows });

  // --- 알림 / 감사 로그 ----------------------------------------------------
  console.log('▶ 알림 및 활동 로그 생성...');
  const upcomingTasks = tasks.filter((task) => task.status !== 'DONE').slice(0, 12);
  for (const task of upcomingTasks) {
    if (!task.assigneeId) continue;
    await prisma.notification.create({
      data: {
        userId: task.assigneeId,
        type: chance(0.5) ? 'TASK_ASSIGNED' : 'TASK_DUE',
        title: '담당 업무 알림',
        message: `${task.title} 업무가 처리 대기 중입니다.`,
        link: `/tasks/${task.id}`,
        isRead: chance(0.4),
        createdAt: daysFromNow(-randomInt(0, 5), randomInt(9, 18)),
      },
    });
  }

  for (const user of users.filter((u) => u.status === 'PENDING')) {
    await prisma.notification.create({
      data: {
        userId: admin.id,
        type: 'USER_PENDING',
        title: '가입 승인 요청',
        message: `${user.name}님이 가입 승인을 기다리고 있습니다.`,
        link: '/admin/users?status=PENDING',
      },
    });
  }

  const logRows: {
    userId: string;
    action: string;
    entityType: string;
    entityId: string | null;
    summary: string;
    createdAt: Date;
  }[] = [];

  for (let index = 0; index < 70; index += 1) {
    const user = pick(activeUsers);
    const kind = randomInt(0, 4);
    const task = pick(tasks);
    const deal = pick(deals);

    const row =
      kind === 0
        ? { action: 'LOGIN', entityType: 'Auth', entityId: user.id, summary: `${user.name} 로그인` }
        : kind === 1
          ? { action: 'CREATE', entityType: 'Task', entityId: task.id, summary: `업무 등록: ${task.title}` }
          : kind === 2
            ? { action: 'STATUS_CHANGE', entityType: 'Task', entityId: task.id, summary: `업무 상태 변경: ${task.title}` }
            : kind === 3
              ? { action: 'UPDATE', entityType: 'Deal', entityId: deal.id, summary: `영업건 수정: ${deal.title}` }
              : { action: 'CREATE', entityType: 'Client', entityId: pick(clients).id, summary: '거래처 등록' };

    logRows.push({ ...row, userId: user.id, createdAt: daysFromNow(-randomInt(0, 30), randomInt(8, 20)) });
  }

  logRows.push({
    userId: admin.id,
    action: 'PERMISSION_CHANGE',
    entityType: 'RolePermission',
    entityId: null,
    summary: '영업담당 역할에 거래처 수정 권한 부여',
    createdAt: daysFromNow(-4, 14),
  });

  await prisma.activityLog.createMany({ data: logRows });

  // --- 요약 ----------------------------------------------------------------
  console.log('\n✅ 시드 완료');
  console.table({
    부서: departments.length,
    직원: users.length,
    거래처: clients.length,
    거래처담당자: allContacts.length,
    영업기회: deals.length,
    업무: tasks.length,
    매출목표: targetRows.length,
    활동로그: logRows.length,
  });
  console.log('\n로그인 계정 (공통 비밀번호: workflow123)');
  console.table([
    { 역할: '시스템 관리자', 이메일: 'admin@workflow.co.kr' },
    { 역할: '팀장', 이메일: 'manager.sales@workflow.co.kr' },
    { 역할: '영업담당', 이메일: 'sales1@workflow.co.kr' },
    { 역할: '직원', 이메일: 'staff1@workflow.co.kr' },
  ]);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
