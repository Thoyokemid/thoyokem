import { useEffect, useState } from 'react';
import { WorkHourDefaults } from '@/utils/attendance';

const FALLBACK: WorkHourDefaults = { jamMasuk: '08:00', jamPulang: '17:00', toleransiMenit: 0 };

export function useWorkHours(): WorkHourDefaults {
  const [workHours, setWorkHours] = useState<WorkHourDefaults>(FALLBACK);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setWorkHours({
          jamMasuk: data.jam_masuk || FALLBACK.jamMasuk,
          jamPulang: data.jam_pulang || FALLBACK.jamPulang,
          toleransiMenit: data.toleransi_menit ? parseInt(data.toleransi_menit, 10) : 0,
        });
      })
      .catch(() => {});
  }, []);

  return workHours;
}
