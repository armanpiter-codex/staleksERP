import { Header } from "@/components/layout/Header";

export default function ProductionPage() {
  return (
    <div>
      <Header title="Производство" />
      <div className="p-6">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          <p className="text-4xl mb-3">🏭</p>
          <p className="font-medium">Производство — в разработке</p>
          <p className="text-sm mt-1">Цехи: Металл · МДФ · Сборка · QR-табель</p>
        </div>
      </div>
    </div>
  );
}
