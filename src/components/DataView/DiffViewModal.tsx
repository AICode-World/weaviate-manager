import { Modal, Tabs, Empty, Typography, Tag } from 'antd';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { useI18n } from '../../i18n/I18nProvider';
import { formatRelativeTime, type QueryRecord } from '../../stores/queryHistoryStore';

const { Text } = Typography;

interface DiffViewModalProps {
  open: boolean;
  onClose: () => void;
  source: QueryRecord | null;
  target: QueryRecord | null;
}

const DiffViewModal: React.FC<DiffViewModalProps> = ({ open, onClose, source, target }) => {
  const { t } = useI18n();

  if (!source || !target) {
    return (
      <Modal
        title={t('diffTitle')}
        open={open}
        onCancel={onClose}
        footer={null}
        width={900}
      >
        <Empty description={t('selectTwoToCompare')} />
      </Modal>
    );
  }

  const sourceVars = source.variables || '';
  const targetVars = target.variables || '';
  const queryIdentical = source.query === target.query && sourceVars === targetVars;

  const sourceLabel = (
    <span>
      <Tag color="blue" style={{ marginRight: 4 }}>{t('sourceLabel')}</Tag>
      <Text style={{ fontSize: 12 }}>
        {source.collection || '—'} · {formatRelativeTime(source.timestamp, t)}
      </Text>
    </span>
  );
  const targetLabel = (
    <span>
      <Tag color="green" style={{ marginRight: 4 }}>{t('targetLabel')}</Tag>
      <Text style={{ fontSize: 12 }}>
        {target.collection || '—'} · {formatRelativeTime(target.timestamp, t)}
      </Text>
    </span>
  );

  return (
    <Modal
      title={t('diffTitle')}
      open={open}
      onCancel={onClose}
      footer={null}
      width={960}
      styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
    >
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
        <div>{sourceLabel}</div>
        <div>{targetLabel}</div>
      </div>
      {queryIdentical && (
        <div style={{ textAlign: 'center', padding: 8, color: 'var(--color-text-tertiary)', fontSize: 13 }}>
          {t('identical')}
        </div>
      )}
      <Tabs
        defaultActiveKey="query"
        items={[
          {
            key: 'query',
            label: t('diffQuery'),
            children: (
              <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                <ReactDiffViewer
                  oldValue={source.query}
                  newValue={target.query}
                  splitView={true}
                  compareMethod={DiffMethod.WORDS}
                  useDarkTheme={true}
                  styles={{
                    contentText: { fontSize: '13px', fontFamily: "'Cascadia Code', 'Fira Code', monospace" },
                    lineNumber: { fontSize: '11px' },
                  }}
                />
              </div>
            ),
          },
          {
            key: 'variables',
            label: t('diffVariables'),
            children: (
              <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                <ReactDiffViewer
                  oldValue={sourceVars}
                  newValue={targetVars}
                  splitView={true}
                  compareMethod={DiffMethod.WORDS}
                  useDarkTheme={true}
                  styles={{
                    contentText: { fontSize: '13px', fontFamily: "'Cascadia Code', 'Fira Code', monospace" },
                    lineNumber: { fontSize: '11px' },
                  }}
                />
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
};

export default DiffViewModal;
