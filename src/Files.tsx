import { t } from "./i18n";import { useEffect, useState } from 'react';
import { ArrowLeft, Folder, FileText, ChevronRight, X } from 'lucide-react';
import { request, type Connection } from './api';
type Listing = {path: string;parent: string | null;entries: {name: string;directory: boolean;path: string;}[];};
export function Files({ connection, root, onProject }: {connection: Connection;root: string;onProject: (path: string) => void;}) {
  const [current, setCurrent] = useState(root),[listing, setListing] = useState<Listing | null>(null);
  const [preview, setPreview] = useState<{name: string;text: string;} | null>(null),[error, setError] = useState(''),[loading, setLoading] = useState(false);
  useEffect(() => {setCurrent(root);}, [root]);
  useEffect(() => {let valid = true;setLoading(true);setError('');setListing(null);request<Listing>(connection, '/files?path=' + encodeURIComponent(current)).then((data) => {if (valid) setListing(data);}).catch((e) => {if (valid) setError(e.message);}).finally(() => {if (valid) setLoading(false);});return () => {valid = false;};}, [connection, current]);
  async function open(path: string) {setError('');try {setPreview(await request(connection, '/file?path=' + encodeURIComponent(path)));} catch (e) {setError((e as Error).message);}}
  return <div className="files-panel"><div className="section-heading"><div><div className="eyebrow">{t("НА ВАШЕМ КОМПЬЮТЕРЕ")}</div><h2>{t("Файлы проекта")}</h2></div><Folder size={26} /></div>
    <div className="breadcrumb"><button className="icon-button" aria-label={t("На папку выше")} disabled={!listing?.parent} onClick={() => listing?.parent && setCurrent(listing.parent)}><ArrowLeft size={17} /></button><code>{current}</code></div>
    <button className="secondary use-folder" disabled={!listing} onClick={() => onProject(current)}>{t("Новый чат в этой папке ")}<ChevronRight size={16} /></button>
    {loading && <p className="muted">{t("Читаем папку на ПК…")}</p>}{error && <div className="error">{t(error)}</div>}
    {listing?.entries.map((e) => <button className="file-row" key={e.path} onClick={() => e.directory ? setCurrent(e.path) : open(e.path)}>{e.directory ? <Folder size={18} /> : <FileText size={18} />}<span>{e.name}</span><ChevronRight size={14} /></button>)}
    {listing?.entries.length === 0 && <p className="muted">{t("В этой папке пока нет файлов.")}</p>}
    {preview && <div className="modal-backdrop"><section className="file-preview"><header><strong>{preview.name}</strong><button className="icon-button" aria-label={t("Закрыть файл")} onClick={() => setPreview(null)}><X size={20} /></button></header><pre>{preview.text}</pre></section></div>}
  </div>;
}
