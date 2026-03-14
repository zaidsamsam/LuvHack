export default function Triage({ selectedType, onTypeSelect }) {
    const options = [
        { id: '', label: 'All Facilities' },
        { id: 'ER', label: 'Emergency Room (ER)', urgent: true },
        { id: 'UrgentCare', label: 'Urgent Care', urgent: false }
    ];

    return (
        <div className="absolute top-24 left-4 z-[1000] w-80 bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden font-sans">
            <div className="p-4 bg-gray-50 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">Smart Triage</h2>
                <p className="text-xs text-gray-500 mt-1">Filter locations by care level</p>
            </div>
            <div className="p-3 flex flex-col gap-2">
                {options.map((opt) => (
                    <button
                        key={opt.id}
                        onClick={() => onTypeSelect(opt.id)}
                        className={`text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center justify-between ${selectedType === opt.id
                                ? 'bg-[#1A73E8] text-white shadow-md'
                                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                            }`}
                    >
                        <span className="font-medium text-sm">{opt.label}</span>
                        {opt.urgent && opt.id === selectedType && (
                            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">
                                High Acuity
                            </span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}
