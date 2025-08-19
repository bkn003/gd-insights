
import { useEffect } from 'react';

export const MobileDashboardFix = () => {
  useEffect(() => {
    // Add CSS to fix mobile dashboard text visibility
    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 768px) {
        .recharts-pie-label-text {
          font-size: 12px !important;
          font-weight: 600 !important;
          fill: currentColor !important;
        }
        
        .recharts-legend-item-text {
          font-size: 12px !important;
          font-weight: 500 !important;
        }
        
        .recharts-pie-sector {
          stroke-width: 1 !important;
        }
        
        /* Ensure text is visible on pie chart segments */
        .recharts-pie-label-text {
          text-anchor: middle !important;
          dominant-baseline: central !important;
        }
        
        /* Fix for circle chart text visibility */
        .recharts-surface text {
          font-size: 11px !important;
          font-weight: 600 !important;
          fill: hsl(var(--foreground)) !important;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return null;
};
