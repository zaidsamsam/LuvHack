import { Clock, MapPin, Activity } from "lucide-react";

export default function HospitalList({ hospitals, loading, onSelect, selectedId }) {
    if (loading) {
        return (
            <div className="absolute top-24 right-4 z-[1000] w-80 bg-white rounded-3xl shadow-lg border border-gray-100 p-6 flex flex-col items-center justify-center font-sans space-y-4">
                <div className="w-8 h-8 border-4 border-[#1A73E8] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-medium text-gray-500 animate-pulse">Calculating Total Time...</p>
            </div>
        );
    }

    if (!hospitals || hospitals.length === 0) {
        return (
            <div className="absolute top-24 right-4 z-[1000] w-80 bg-white rounded-3xl shadow-xl border border-gray-100 p-6 flex flex-col items-center justify-center font-sans space-y-3 text-center">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex flex-col items-center justify-center text-gray-400 mb-2">
                    <MapPin size={24} />
                </div>
                <h3 className="text-gray-900 font-bold">No facilities found.</h3>
                <p className="text-sm text-gray-500">No facilities found within 100km. Try expanding your search or checking your connection.</p>
            </div>
        );
    }

    return (
        <div className="absolute top-24 right-4 z-[1000] w-80 bg-white rounded-3xl shadow-xl border border-gray-100 flex flex-col max-h-[70vh] overflow-hidden font-sans">
            <div className="p-4 bg-gradient-to-r from-[#1A73E8] to-[#3b82f6] text-white">
                <h2 className="text-lg font-bold">Fastest Care Options</h2>
                <p className="text-xs opacity-90">Sorted by lowest Total Time</p>
            </div>

            <div className="overflow-y-auto flex-1 p-2 space-y-2 relative">
                {hospitals.map((hospital, index) => {
                    const isWinner = index === 0;
                    const isSelected = selectedId === hospital.id;

                    return (
                        <div
                            key={hospital.id}
                            onClick={() => onSelect(hospital)}
                            className={`p-4 rounded-2xl cursor-pointer transition-all border ${isSelected
                                    ? 'border-[#1A73E8] bg-blue-50 ring-2 ring-blue-100 shadow-sm'
                                    : 'border-gray-100 bg-white hover:border-gray-300 hover:shadow-sm'
                                }`}
                        >
                            {isWinner && (
                                <div className="inline-flex items-center gap-1 bg-[#34A853] text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mb-2">
                                    <Activity size={12} /> Best Option
                                </div>
                            )}

                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-gray-900 text-sm">{hospital.name}</h3>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${hospital.facility_type === 'ER'
                                        ? 'bg-red-50 text-[#EA4335] border-red-100'
                                        : 'bg-green-50 text-[#34A853] border-green-100'
                                    }`}
                                >
                                    {hospital.facility_type}
                                </span>
                            </div>

                            <div className="flex items-center gap-4 text-xs mt-3">
                                <div className="flex items-center gap-1">
                                    <Clock size={14} className="text-[#1A73E8]" />
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-900">{hospital.total_time} min</span>
                                        <span className="text-[9px] text-gray-400 font-medium">TOTAL TIME</span>
                                    </div>
                                </div>

                                <div className="h-6 w-px bg-gray-200"></div>

                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                        <MapPin size={10} /> {hospital.drive_time}m drive
                                    </span>
                                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                        <Activity size={10} /> {hospital.base_wait_time}m wait
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
