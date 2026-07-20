import { useState } from 'react';
import { Modal, Input, Button, Alert, App } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { unlockMasterKey } from '../../utils/crypto';
import { useClusterStore } from '../../stores/clusterStore';
import { useI18n } from '../../i18n/I18nProvider';

interface Props {
  open: boolean;
  onClose: () => void;
}

const MasterPasswordModal: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useI18n();
  const { message } = App.useApp();
  const { reEncryptApiKeys } = useClusterStore();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUnlock = async () => {
    if (!password.trim()) {
      setError(t('masterPasswordRequired'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await unlockMasterKey(password);
      await reEncryptApiKeys();
      message.success(t('masterPasswordUnlocked'));
      setPassword('');
      onClose();
    } catch {
      setError(t('masterPasswordWrong'));
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    setPassword('');
    setError('');
    onClose();
  };

  return (
    <Modal
      open={open}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LockOutlined />
          {t('masterPasswordTitle')}
        </div>
      }
      footer={null}
      closable={false}
      maskClosable={false}
      width={420}
      centered
    >
      <Alert
        type="info"
        showIcon
        message={t('masterPasswordDesc')}
        style={{ marginBottom: 16 }}
      />

      <Input.Password
        placeholder={t('masterPasswordPlaceholder')}
        size="large"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onPressEnter={handleUnlock}
        autoFocus
        style={{ marginBottom: error ? 8 : 16 }}
      />

      {error && (
        <Alert
          type="error"
          message={error}
          style={{ marginBottom: 16 }}
          closable
          onClose={() => setError('')}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={handleSkip}>
          {t('skip')}
        </Button>
        <Button type="primary" loading={loading} onClick={handleUnlock}>
          {t('unlock')}
        </Button>
      </div>
    </Modal>
  );
};

export default MasterPasswordModal;
