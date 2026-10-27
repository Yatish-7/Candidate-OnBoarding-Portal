import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Dropdown, Grid, Layout, Menu, Space, Tag, Typography } from 'antd'
import {
  KeyOutlined,
  ApartmentOutlined,
  DashboardOutlined,
  DownOutlined,
  HistoryOutlined,
  LogoutOutlined,
  SettingOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import { useAuth } from '../context/AuthContext.js'
import { USE_MOCKS } from '../utils/env.js'
import { CANDIDATE_ROLES, ROLE_LABELS } from '../utils/roles.js'
import Logo from './Logo.jsx'
import NameAvatar from './NameAvatar.jsx'
import RoleSwitcher from './RoleSwitcher.jsx'
import SessionTimeout from './SessionTimeout.jsx'

const { Header, Sider, Content, Footer } = Layout

// Sidebar links. "roles" lists who may see each link; no "roles" means everyone.
const MENU_ITEMS = [
  {
    key: '/admin',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
    roles: ['SUPER_ADMIN'],
  },
  {
    key: '/candidates',
    icon: <TeamOutlined />,
    label: 'Candidates',
    // Admin has no candidate access, so everyone in the workflow but not Admin.
    roles: CANDIDATE_ROLES,
  },
  {
    key: '/candidates/new',
    icon: <UserAddOutlined />,
    label: 'New candidate',
    roles: ['RECRUITER'],
  },
  {
    key: '/admin/users',
    icon: <SettingOutlined />,
    label: 'Users',
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    key: '/admin/teams',
    icon: <ApartmentOutlined />,
    label: 'Teams',
    roles: ['SUPER_ADMIN', 'ADMIN', 'SALES_LEAD', 'SALES_MANAGER'],
  },
  {
    key: '/admin/audit',
    icon: <HistoryOutlined />,
    label: 'Audit log',
    roles: ['SUPER_ADMIN'],
  },
]

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  // Start collapsed on screens narrower than antd's "lg" breakpoint (992px), so phones never
  // briefly show the open sidebar while the page loads
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 992)
  // Which screen sizes are active right now, e.g. screens.md is true on tablets and up
  const screens = Grid.useBreakpoint()

  // Keep only the links this role may see, and drop "roles" (antd's Menu doesn't know it)
  const menuItems = MENU_ITEMS.filter((item) => !item.roles || item.roles.includes(user.role)).map(
    ({ roles: _roles, ...item }) => item,
  )

  // Highlight the menu link that best matches the current URL.
  // We pick the longest match so /candidates/new highlights "New candidate", not "Candidates".
  const selectedKey =
    menuItems
      .map((item) => item.key)
      .filter((key) => location.pathname.startsWith(key))
      .sort((a, b) => b.length - a.length)[0] ?? ''

  async function handleLogout() {
    await logout() // ends the session on the server too
    navigate('/login')
  }

  // The menu that opens when you click your name in the header
  const userMenu = {
    items: [
      {
        key: 'me',
        disabled: true, // just information, not clickable
        label: (
          <div style={{ color: '#0f172a' }}>
            <div style={{ fontWeight: 600 }}>{user.name}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{user.email}</div>
          </div>
        ),
      },
      { type: 'divider' },
      { key: 'password', icon: <KeyOutlined />, label: 'Change password' },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Log out', danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'logout') handleLogout()
      if (key === 'password') navigate('/change-password')
    },
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* On small screens (below "lg") the sidebar collapses fully, so mobile doesn't break */}
      <Sider
        width={240}
        breakpoint="lg"
        collapsedWidth={0}
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{ boxShadow: '1px 0 0 rgba(15, 23, 42, 0.08)' }}
        // On small screens the ≡ button that opens the sidebar sits in the header's top-left corner
        zeroWidthTriggerStyle={{ top: 14, zIndex: 20, borderRadius: 8 }}
      >
        {/* overflow: hidden stops the logo and menu from spilling out while the sidebar is collapsed to 0px */}
        <div style={{ overflow: 'hidden' }}>
          <div style={{ padding: '20px 16px 18px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: 12 }}>
            {/* Full-colour logo on a soft light tile so its black wordmark reads on the dark sidebar */}
            <div
              style={{
                background: '#f8fafc',
                borderRadius: 12,
                padding: '10px 14px',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25), inset 0 0 0 1px rgba(255, 255, 255, 0.6)',
              }}
            >
              <Logo style={{ height: 'auto', width: '100%', maxWidth: 176, margin: '0 auto' }} />
            </div>
            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 8, paddingLeft: 2 }}>Onboarding Portal</div>
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
          />
        </div>
      </Sider>

      <Layout>
        <Header
          style={{
            position: 'sticky', // stays at the top while the page scrolls
            top: 0,
            zIndex: 10,
            height: 'auto', // let the header grow if its items wrap onto two lines on small screens
            minHeight: 64,
            lineHeight: 'normal',
            padding: '8px 24px',
            // When the sidebar is hidden (small screens), its ≡ button sits at the left edge,
            // so leave room for it
            paddingLeft: collapsed ? 64 : 24,
            borderBottom: '1px solid #e8ecf3',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Left: the dev-only role switcher (mock mode). An empty div keeps the user menu on the right. */}
          {USE_MOCKS ? (
            // flex + minWidth: 0 lets this group shrink on narrow screens instead of overflowing
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 200px', minWidth: 0, maxWidth: 360 }}>
              <Tag color="orange" variant="filled" style={{ margin: 0 }}>
                MOCK
              </Tag>
              <RoleSwitcher />
            </div>
          ) : collapsed ? (
            // When the sidebar is hidden (mobile/collapsed), show the logo in the header
            <Logo height={28} />
          ) : (
            <div />
          )}

          {/* Right: who is logged in, with a menu to log out */}
          <Dropdown menu={userMenu} trigger={['click']} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <NameAvatar name={user.name} />
              {screens.md && (
                <div style={{ lineHeight: 1.25 }}>
                  <Typography.Text strong>{user.name}</Typography.Text>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {ROLE_LABELS[user.role]}
                    {user.teamName && ` · ${user.teamName}`}
                  </div>
                </div>
              )}
              <DownOutlined style={{ fontSize: 10, color: '#94a3b8' }} />
            </Space>
          </Dropdown>
        </Header>

        <Content style={{ padding: screens.md ? 24 : 16 }}>
          {/* Keep pages from getting too wide on very large screens */}
          <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            {/* <Outlet /> is where the current page (from App.jsx) is drawn */}
            <Outlet />
            {/* Signs out after inactivity, with a "still there?" warning first */}
            <SessionTimeout />
          </div>
        </Content>

        <Footer
          style={{
            textAlign: 'center',
            background: 'transparent',
            color: '#94a3b8',
            fontSize: 13,
            padding: '16px 24px 24px',
          }}
        >
          © {new Date().getFullYear()} One Intellectt · Candidate Onboarding Portal
        </Footer>
      </Layout>
    </Layout>
  )
}
