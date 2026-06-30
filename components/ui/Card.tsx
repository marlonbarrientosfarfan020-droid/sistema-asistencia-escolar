type CardProps = {
  children: React.ReactNode;
};

export default function Card({ children }: CardProps) {
  return (
    <div className="bg-white rounded-2xl shadow p-6">
      {children}
    </div>
  );
}