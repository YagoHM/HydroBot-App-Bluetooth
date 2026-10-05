import { useBluetooth } from '../context/BluetoothContext';
import AppModal from './AppModal';

/** Exibe com o AppModal os avisos de conexão gerados pelo contexto. */
export default function NoticeHost() {
  const { notice, clearNotice } = useBluetooth();
  return (
    <AppModal
      visible={notice !== null}
      title={notice?.title ?? ''}
      message={notice?.message}
      onRequestClose={clearNotice}
    />
  );
}
