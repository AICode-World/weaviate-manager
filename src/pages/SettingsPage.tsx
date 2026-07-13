import { Card, Segmented, Tooltip, Typography, Tag } from 'antd';
import { SunOutlined, MoonOutlined, DesktopOutlined } from '@ant-design/icons';
import useAppStore, { THEME_PRESETS } from '../stores/appStore';
import { useI18n } from '../i18n/I18nProvider';

const { Text } = Typography;

const SettingsPage: React.FC = () => {
  const { t, lang, setLang } = useI18n();
  const { themeMode, setThemeMode, themeColor, setThemeColor } = useAppStore();

  const themeModeOptions = [
    { label: <span><SunOutlined /> {t('lightMode')}</span>, value: 'light' },
    { label: <span><MoonOutlined /> {t('darkMode')}</span>, value: 'dark' },
    { label: <span><DesktopOutlined /> {t('systemMode')}</span>, value: 'system' },
  ];

  const langOptions = [
    { label: t('langLabelZh'), value: 'zh' },
    { label: t('langLabelEn'), value: 'en' },
  ];

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
          <Text code style={{ fontSize: 13 }}>0.1.2-beta</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{t('license')}</Text>
          <Text strong style={{ fontSize: 13 }}>MIT License</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>PWA</Text>
          <Tag color="green">{t('enabled')}</Tag>
        </div>
      </Card>
    </div>
  );
};

export default SettingsPage;
