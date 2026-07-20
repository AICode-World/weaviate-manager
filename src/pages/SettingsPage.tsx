import { useState } from 'react';
import { Card, Segmented, Tooltip, Typography, Tag, Button, Modal, Input, App, Space } from 'antd';
import { SunOutlined, MoonOutlined, DesktopOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';
import { useThemeStore, THEME_PRESETS } from '../stores/themeStore';
import { useClusterStore } from '../stores/clusterStore';
import { useI18n } from '../i18n/I18nProvider';
import { version } from '../../package.json';
import { unlockMasterKey, lockMasterKey, isUnlocked } from '../utils/crypto';

const { Text } = Typography;

const SettingsPage: React.FC = () => {
  const { t, lang, setLang } = useI18n();
  const { themeMode, setThemeMode, themeColor, setThemeColor } = useThemeStore();
  const { reEncryptApiKeys } = useClusterStore();
  const { message } = App.useApp();

  const [masterPasswordOpen, setMasterPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [unlocked, setUnlocked] = useState(isUnlocked());

  const themeModeOptions = [
    { label: <span><SunOutlined /> {t('lightMode')}</span>, value: 'light' },
    { label: <span><MoonOutlined /> {t('darkMode')}</span>, value: 'dark' },
    { label: <span><DesktopOutlined /> {t('systemMode')}</span>, value: 'system' },
  ];

  const langOptions = [
    { label: t('langLabelZh'), value: 'zh' },
    { label: t('langLabelEn'), value: 'en' },
  ];

  const handleSetMasterPassword = async () => {
    if (!newPassword.trim()) {
      message.warning(t('masterPasswordRequired'));
      return;
    }
    try {
      await unlockMasterKey(newPassword);
      await reEncryptApiKeys();
      setUnlocked(true);
      message.success(t('masterPasswordSet'));
      setNewPassword('');
      setMasterPasswordOpen(false);
    } catch {
      message.error(t('masterPasswordWrong'));
    }
  };

  const handleLock = () => {
    lockMasterKey();
    setUnlocked(false);
    message.success(t('masterPasswordLocked'));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">{t('settings')}</div>
          <div className="page-subtitle">{t('settingsDesc')}</div>
        </div>
      </div>

      {/* Appearance */}
      <Card className="glass-card" title={t('appearance')} size="small">
        <div className="settings-row">
          <div>
            <div className="settings-label">{t('themeModeLabel')}</div>
            <div className="settings-desc">{t('themeModeDesc')}</div>
          </div>
          <Segmented options={themeModeOptions} value={themeMode} onChange={(v) => setThemeMode(v as 'light' | 'dark' | 'system')} />
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">{t('themeColor')}</div>
            <div className="settings-desc">{t('themeColorDesc')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {THEME_PRESETS.map((preset) => (
              <Tooltip key={preset.name} title={preset.name}>
                <div
                  onClick={() => setThemeColor(preset.color)}
                  style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: preset.color, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: themeColor === preset.color ? '2px solid var(--color-text-primary)' : '2px solid transparent',
                    transition: 'border-color 0.2s',
                  }}
                >
                  {themeColor === preset.color && <span style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>✓</span>}
                </div>
              </Tooltip>
            ))}
          </div>
        </div>
      </Card>

      {/* Security */}
      <Card className="glass-card" title={<span><LockOutlined style={{ marginRight: 6 }} />{t('setMasterPassword')}</span>} size="small">
        <div className="settings-row">
          <div>
            <div className="settings-label">{t('setMasterPassword')}</div>
            <div className="settings-desc">{t('setMasterPasswordDesc')}</div>
            <div className="settings-desc" style={{ color: 'var(--color-text-quaternary)', marginTop: 4 }}>
              {t('setMasterPasswordHint')}
            </div>
          </div>
          <Space direction="vertical" align="end" size={8}>
            <Tag color={unlocked ? 'green' : 'default'}>
              {unlocked ? t('masterPasswordSetStatus') : t('masterPasswordNotSet')}
            </Tag>
            {unlocked ? (
              <Button size="small" icon={<LockOutlined />} onClick={handleLock}>
                {t('lockMasterPassword')}
              </Button>
            ) : (
              <Button type="primary" size="small" icon={<UnlockOutlined />} onClick={() => setMasterPasswordOpen(true)}>
                {t('setMasterPassword')}
              </Button>
            )}
          </Space>
        </div>
      </Card>

      {/* Language */}
      <Card className="glass-card" title={t('languageSection')} size="small">
        <div className="settings-row">
          <div>
            <div className="settings-label">{t('interfaceLang')}</div>
            <div className="settings-desc">{t('interfaceLangDesc')}</div>
          </div>
          <Segmented options={langOptions} value={lang} onChange={(v) => setLang(v as 'zh' | 'en')} />
        </div>
      </Card>

      {/* About */}
      <Card className="glass-card" title={t('about')} size="small">
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px 16px', paddingTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>{t('appNameLabel')}</Text>
          <Text strong style={{ fontSize: 13 }}>Weaviate Manager</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{t('versionLabel')}</Text>
          <Text code style={{ fontSize: 13 }}>v{version}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{t('license')}</Text>
          <Text strong style={{ fontSize: 13 }}>MIT License</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>PWA</Text>
          <Tag color="green">{t('enabled')}</Tag>
        </div>
      </Card>

      {/* Master Password Modal */}
      <Modal
        open={masterPasswordOpen}
        title={<span><LockOutlined style={{ marginRight: 6 }} />{t('setMasterPassword')}</span>}
        onCancel={() => { setMasterPasswordOpen(false); setNewPassword(''); }}
        onOk={handleSetMasterPassword}
        okText={t('confirm')}
        cancelText={t('cancel')}
        width={420}
      >
        <div style={{ marginBottom: 12, color: 'var(--color-text-tertiary)', fontSize: 13 }}>
          {t('setMasterPasswordHint')}
        </div>
        <Input.Password
          placeholder={t('masterPasswordPlaceholder')}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          onPressEnter={handleSetMasterPassword}
          autoFocus
          size="large"
        />
      </Modal>
    </div>
  );
};

export default SettingsPage;
