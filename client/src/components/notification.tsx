import { ReactNode } from 'react';
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, X } from 'lucide-react';

interface NotificationProps {
  title: string;
  description: string;
  type: "success" | "error";
  children?: ReactNode;
}

export function Notification({ title, description, type, children }: NotificationProps) {
  const bgColor = type === "success" ? "bg-discord-success" : "bg-discord-error";
  
  return (
    <div className={`fixed bottom-4 right-4 max-w-md rounded-lg shadow-lg p-4 ${bgColor} text-white transition-opacity duration-300`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {type === "success" ? (
            <CheckCircle className="h-6 w-6" />
          ) : (
            <XCircle className="h-6 w-6" />
          )}
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm">{description}</p>
          {children}
        </div>
        <div className="ml-auto pl-3">
          <ToastClose asChild>
            <button
              type="button"
              className="inline-flex text-white hover:text-gray-200"
            >
              <X className="h-5 w-5" />
            </button>
          </ToastClose>
        </div>
      </div>
    </div>
  );
}

export function Notifications() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const isSuccess = props.className?.includes("bg-discord-success");
        const isError = props.variant === "destructive";
        const type = isSuccess ? "success" : isError ? "error" : "success";
        
        return (
          <Toast key={id} {...props}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {type === "success" ? (
                  <CheckCircle className="h-6 w-6" />
                ) : (
                  <XCircle className="h-6 w-6" />
                )}
              </div>
              <div className="ml-3">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
                {action}
              </div>
              <div className="ml-auto pl-3">
                <ToastClose />
              </div>
            </div>
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
