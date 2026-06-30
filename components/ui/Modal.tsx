type ModalProps = {
  abierto: boolean;
  titulo: string;
  children: React.ReactNode;
  onCerrar: () => void;
};

export default function Modal({
  abierto,
  titulo,
  children,
  onCerrar,
}: ModalProps) {
  if (!abierto) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-bold text-slate-900">{titulo}</h2>

          <button
            onClick={onCerrar}
            className="text-slate-500 hover:text-slate-900 font-bold text-xl"
          >
            ✕
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}