import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Upload, Download, Package } from 'lucide-react';

export type OperationType = 'upload' | 'download' | null;

interface OperationSelectorProps {
  onChange: (operation: OperationType) => void;
}

export function OperationSelector({ onChange }: OperationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<OperationType>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const selectOption = (option: OperationType) => {
    setSelectedOption(option);
    setIsOpen(false);
    onChange(option);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button 
        className="w-full bg-white dark:bg-[hsl(var(--cyber-dark))] rounded-md py-3 px-4 
                  text-left font-medium flex justify-between items-center
                  border border-transparent shadow-md
                  hover:border-cyber-purple/20 transition-all duration-200"
        onClick={toggleDropdown}
      >
        <div className="flex items-center">
          {selectedOption === null && <Package className="h-5 w-5 mr-2 text-cyber-purple" />}
          {selectedOption === 'upload' && <Upload className="h-5 w-5 mr-2 text-cyber-purple" />}
          {selectedOption === 'download' && <Download className="h-5 w-5 mr-2 text-cyber-purple" />}
          <span className="dark:text-white">
            {selectedOption === 'upload' && 'Upload'}
            {selectedOption === 'download' && 'Download'}
            {selectedOption === null && 'Select Operation'}
          </span>
        </div>
        <ChevronDown 
          className={`h-5 w-5 text-cyber-purple transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      
      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-[hsl(var(--cyber-dark))] rounded-md shadow-lg 
                       border border-gray-100 dark:border-gray-800 
                       overflow-hidden z-10 transition-all duration-200
                       animate-in fade-in slide-in-from-top-5">
          <ul className="py-1">
            <li>
              <button 
                className="w-full text-left px-4 py-3 hover:bg-cyber-purple/10 dark:hover:bg-cyber-purple/20
                          transition-colors duration-150 focus:outline-none"
                onClick={() => selectOption('upload')}
              >
                <div className="flex items-center">
                  <Upload className="h-5 w-5 mr-3 text-cyber-purple" />
                  <span className="font-medium dark:text-white">Upload</span>
                </div>
              </button>
            </li>
            <li>
              <button 
                className="w-full text-left px-4 py-3 hover:bg-cyber-purple/10 dark:hover:bg-cyber-purple/20
                          transition-colors duration-150 focus:outline-none"
                onClick={() => selectOption('download')}
              >
                <div className="flex items-center">
                  <Download className="h-5 w-5 mr-3 text-cyber-light-purple" />
                  <span className="font-medium dark:text-white">Download</span>
                </div>
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
