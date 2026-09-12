import { prisma } from '@/lib/db';
import { getMyPermissions, requireUser } from '@/lib/auth';
import { filterNavigation } from '@/lib/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { UserMenu } from '@/components/layout/UserMenu';

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await requireUser();
  const permissions = await getMyPermissions();

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
  ]);

  const topbar = (
    <div className="flex flex-1 items-center justify-end gap-1.5">
      <NotificationBell
        unreadCount={unreadCount}
        items={notifications.map((notification) => ({
          id: notification.id,
          title: notification.title,
          message: notification.message,
          link: notification.link,
          isRead: notification.isRead,
          createdAt: notification.createdAt.toISOString(),
        }))}
      />
      <div className="mx-1 h-6 w-px bg-line" aria-hidden />
      <UserMenu
        name={user.name}
        email={user.email}
        role={user.role}
        position={user.position}
        departmentName={user.departmentName}
        avatarColor={user.avatarColor}
      />
    </div>
  );

  return (
    <AppShell nav={filterNavigation(permissions)} topbar={topbar}>
      {children}
    </AppShell>
  );
}
