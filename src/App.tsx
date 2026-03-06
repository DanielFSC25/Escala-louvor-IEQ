import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, 
  Users, 
  Plus, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Music, 
  Mic2, 
  Drum, 
  Guitar, 
  LayoutDashboard,
  Save,
  X,
  Pencil,
  Filter,
  Eye,
  EyeOff,
  BarChart2,
  Search,
  FileDown,
  Upload,
  UserMinus,
  Menu,
  Sparkles,
  Lock,
  LogIn,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Types
interface Member {
  id: number;
  name: string;
  roles: string;
  only_sundays: number;
  is_active: number;
}

interface Assignment {
  id: number;
  role: string;
  name: string;
  member_id: number;
}

interface Service {
  id: number;
  date: string;
  type: string;
  assignments: Assignment[];
}

interface User {
  role: 'admin' | 'membro';
  name: string;
}

const SCHEDULE_ROLES = [
  'Ministro',
  'Bateria',
  'Teclado',
  'Baixo',
  'Guitarra',
  'Violão',
  'Backing Vocal 1',
  'Backing Vocal 2',
  'Backing Vocal 3',
  'Backing Vocal 4'
];

const MEMBER_ROLES = [
  'Ministro',
  'Bateria',
  'Teclado',
  'Baixo',
  'Guitarra',
  'Violão',
  'Backing'
];

const SERVICE_TYPES = [
  'Quarta',
  'Sexta',
  'Domingo Manhã',
  'Domingo Noite'
];

const sortAssignments = (assignments: Assignment[]) => {
  return [...assignments].sort((a, b) => {
    const indexA = SCHEDULE_ROLES.indexOf(a.role);
    const indexB = SCHEDULE_ROLES.indexOf(b.role);
    return indexA - indexB;
  });
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'members'>('schedule');
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [members, setMembers] = useState<Member[]>([]);
  const [schedule, setSchedule] = useState<Service[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthViewMode, setMonthViewMode] = useState<'calendar' | 'list'>('calendar');
  const [visibleRoles, setVisibleRoles] = useState<string[]>(SCHEDULE_ROLES);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isShowingStats, setIsShowingStats] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [scheduleSearchTerm, setScheduleSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingServices, setEditingServices] = useState<number[]>([]);
  const [reportSchedule, setReportSchedule] = useState<Service[]>([]);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('worship_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Member Form State
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [onlySundays, setOnlySundays] = useState(false);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [currentWeekStart, currentMonth, viewMode]);

  const handleSetViewMode = (mode: 'week' | 'month') => {
    if (mode === 'week') {
      // Se estivermos mudando para semana, sincronizamos o início da semana com o mês atual
      // Se a semana atual já estiver dentro do mês, não mudamos para não perder o contexto
      const weekMonth = currentWeekStart.getMonth();
      const weekYear = currentWeekStart.getFullYear();
      if (weekMonth !== currentMonth.getMonth() || weekYear !== currentMonth.getFullYear()) {
        const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const day = firstDay.getDay();
        const diff = firstDay.getDate() - day + (day === 0 ? -6 : 1);
        setCurrentWeekStart(new Date(firstDay.setDate(diff)));
      }
    } else {
      // Se estivermos mudando para mês, sincronizamos o mês com o início da semana atual
      setCurrentMonth(new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), 1));
    }
    setViewMode(mode);
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('ATENÇÃO: Importar um backup irá SUBSTITUIR todos os dados atuais. Deseja continuar?')) {
      e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('backup', file);

    try {
      const res = await fetch('/api/restore', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        alert('Backup restaurado com sucesso! A página será recarregada.');
        window.location.reload();
      } else {
        const data = await res.json();
        alert(`Erro ao restaurar backup: ${data.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao restaurar backup:', error);
      alert('Erro ao conectar com o servidor para restaurar backup.');
    } finally {
      e.target.value = '';
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/members');
      if (!res.ok) throw new Error('Falha ao buscar membros');
      const data = await res.json();
      setMembers(data);
    } catch (error) {
      console.error('Erro ao buscar membros:', error);
    }
  };

  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fetchSchedule = async () => {
    let start, end;
    if (viewMode === 'week') {
      start = formatLocalDate(currentWeekStart);
      end = formatLocalDate(new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000));
    } else {
      const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      start = formatLocalDate(firstDay);
      end = formatLocalDate(lastDay);
    }
    const res = await fetch(`/api/schedule?start=${start}&end=${end}`);
    const data = await res.json();
    setSchedule(data);
    
    // If we are in month view, also update report schedule
    if (viewMode === 'month') {
      setReportSchedule(data);
    }
  };

  const fetchReportData = async () => {
    setIsLoadingReport(true);
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const start = formatLocalDate(firstDay);
    const end = formatLocalDate(lastDay);
    
    try {
      const res = await fetch(`/api/schedule?start=${start}&end=${end}`);
      const data = await res.json();
      setReportSchedule(data);
      setIsShowingStats(true);
    } catch (error) {
      console.error("Erro ao buscar relatório:", error);
    } finally {
      setIsLoadingReport(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName) return;
    
    const url = editingMember ? `/api/members/${editingMember.id}` : '/api/members';
    const method = editingMember ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newMemberName, 
          roles: selectedRoles.join(','),
          only_sundays: onlySundays ? 1 : 0,
          is_active: isActive ? 1 : 0
        })
      });
      
      if (!res.ok) throw new Error('Falha ao salvar membro');
      
      setNewMemberName('');
      setSelectedRoles([]);
      setOnlySundays(false);
      setIsActive(true);
      setEditingMember(null);
      setIsAddingMember(false);
      await fetchMembers();
      if (editingMember) fetchSchedule();
    } catch (error) {
      console.error('Erro ao salvar membro:', error);
      alert('Erro ao salvar membro. Por favor, tente novamente.');
    }
  };

  const handleEditMember = (member: Member) => {
    setEditingMember(member);
    setNewMemberName(member.name);
    setSelectedRoles(member.roles.split(',').filter(r => r));
    setOnlySundays(member.only_sundays === 1);
    setIsActive(member.is_active === 1);
    setIsAddingMember(true);
  };

  const closeModal = () => {
    setIsAddingMember(false);
    setEditingMember(null);
    setNewMemberName('');
    setSelectedRoles([]);
    setOnlySundays(false);
    setIsActive(true);
  };

  const handleDeleteMember = async (id: number) => {
    try {
      const res = await fetch(`/api/members/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao excluir membro');
      fetchMembers();
      fetchSchedule();
    } catch (error) {
      console.error('Erro ao excluir membro:', error);
      alert('Erro ao excluir membro.');
    }
  };

  const handleAssign = async (serviceId: number, role: string, memberId: number | null) => {
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: serviceId, member_id: memberId, role })
      });
      if (!res.ok) throw new Error('Falha ao atribuir membro');
      fetchSchedule();
    } catch (error) {
      console.error('Erro ao atribuir membro:', error);
      alert('Erro ao salvar atribuição.');
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const monthName = currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    
    doc.setFontSize(18);
    doc.text(`Escala de Louvor - ${monthName}`, 14, 15);
    
    const tableColumn = ["Data", "Culto", ...SCHEDULE_ROLES];
    const tableRows: any[] = [];

    // Filter and sort services for the current month
    const currentMonthServices = schedule
      .filter(s => {
        const d = new Date(s.date + 'T12:00:00');
        return d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear();
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    currentMonthServices.forEach(service => {
      const date = new Date(service.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const rowData = [
        date,
        service.type,
        ...SCHEDULE_ROLES.map(role => {
          const assignment = service.assignments.find(a => a.role === role);
          return assignment ? assignment.name : '-';
        })
      ];
      tableRows.push(rowData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 25,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { top: 25 },
    });

    doc.save(`escala-louvor-${monthName.replace(' ', '-')}.pdf`);
  };

  const createService = async (date: string, type: string) => {
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, type })
      });
      if (!res.ok) throw new Error('Falha ao criar culto');
      const newService = await res.json();
      setEditingServices(prev => [...prev, newService.id]);
      fetchSchedule();
    } catch (error) {
      console.error('Erro ao criar culto:', error);
      alert('Erro ao criar culto.');
    }
  };

  const handleDeleteService = async (id: number) => {
    try {
      const res = await fetch(`/api/services/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao excluir culto');
      fetchSchedule();
    } catch (error) {
      console.error('Erro ao excluir culto:', error);
      alert('Erro ao excluir culto.');
    }
  };

  const handleAutoFill = async () => {
    const isMonth = viewMode === 'month';
    const periodName = isMonth ? 'mês' : 'semana';
    
    setIsAutoFilling(true);
    try {
      // 1. Identify all relevant days for the period
      const servicesToCreate = [];
      let start: string, end: string;
      let startDate: Date, endDate: Date;

      if (isMonth) {
        startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        const daysInMonth = endDate.getDate();
        
        for (let d = 1; d <= daysInMonth; d++) {
          const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
          const dayOfWeek = date.getDay();
          const dateStr = formatLocalDate(date);
          
          if (dayOfWeek === 3) servicesToCreate.push({ date: dateStr, type: 'Quarta' });
          else if (dayOfWeek === 5) servicesToCreate.push({ date: dateStr, type: 'Sexta' });
          else if (dayOfWeek === 0) {
            servicesToCreate.push({ date: dateStr, type: 'Domingo Manhã' });
            servicesToCreate.push({ date: dateStr, type: 'Domingo Noite' });
          }
        }
        start = formatLocalDate(startDate);
        end = formatLocalDate(endDate);
      } else {
        startDate = new Date(currentWeekStart);
        endDate = new Date(currentWeekStart);
        endDate.setDate(endDate.getDate() + 6);
        
        for (let i = 0; i < 7; i++) {
          const date = new Date(currentWeekStart);
          date.setDate(date.getDate() + i);
          const dayOfWeek = date.getDay();
          const dateStr = formatLocalDate(date);
          
          if (dayOfWeek === 3) servicesToCreate.push({ date: dateStr, type: 'Quarta' });
          else if (dayOfWeek === 5) servicesToCreate.push({ date: dateStr, type: 'Sexta' });
          else if (dayOfWeek === 0) {
            servicesToCreate.push({ date: dateStr, type: 'Domingo Manhã' });
            servicesToCreate.push({ date: dateStr, type: 'Domingo Noite' });
          }
        }
        start = formatLocalDate(startDate);
        end = formatLocalDate(endDate);
      }

      // 2. Fetch fresh data
      const [membersRes, scheduleRes] = await Promise.all([
        fetch('/api/members'),
        fetch(`/api/schedule?start=${start}&end=${end}`)
      ]);
      
      const freshMembers: Member[] = await membersRes.json();
      const currentSchedule: Service[] = await scheduleRes.json();
      
      const activeMembers = freshMembers.filter(m => m.is_active === 1);
      if (activeMembers.length === 0) {
        setIsAutoFilling(false);
        return;
      }

      // 3. Create missing services
      const existingDates = currentSchedule.map(s => `${s.date}-${s.type}`);
      for (const s of servicesToCreate) {
        if (!existingDates.includes(`${s.date}-${s.type}`)) {
          await fetch('/api/services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(s)
          });
        }
      }

      // 4. Refresh schedule to get all IDs
      const refreshRes = await fetch(`/api/schedule?start=${start}&end=${end}`);
      const updatedSchedule: Service[] = await refreshRes.json();

      if (updatedSchedule.length === 0) {
        setIsAutoFilling(false);
        return;
      }

      // 5. Fill assignments
      let assignmentsCount = 0;
      // Shuffle schedule to distribute members better if filling month
      const shuffledSchedule = [...updatedSchedule].sort(() => Math.random() - 0.5);

      for (const service of shuffledSchedule) {
        const isSunday = new Date(service.date + 'T12:00:00').getDay() === 0;
        
        for (const role of SCHEDULE_ROLES) {
          // Skip Backing Vocal 4 as requested by user (manual selection only)
          if (role === 'Backing Vocal 4') continue;

          if (service.assignments.some(a => a.role === role)) continue;

          const eligibleMembers = activeMembers.filter(m => {
            const roles = m.roles.split(',').map(r => r.trim()).filter(r => r);
            const hasRole = roles.length === 0 || roles.includes(role) || (role.startsWith('Backing') && roles.includes('Backing'));
            if (!hasRole) return false;
            if (!isSunday && m.only_sundays === 1) return false;
            return true;
          });

          if (eligibleMembers.length > 0) {
            // Priority to those not already in this service
            const availableMembers = eligibleMembers.filter(m => 
              !service.assignments.some(a => a.member_id === m.id)
            );

            if (availableMembers.length > 0) {
              // Simple randomization
              const randomMember = availableMembers[Math.floor(Math.random() * availableMembers.length)];
              
              const assignRes = await fetch('/api/assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  service_id: service.id,
                  member_id: randomMember.id,
                  role: role
                })
              });
              
              if (assignRes.ok) {
                assignmentsCount++;
                service.assignments.push({
                  id: 0,
                  role: role,
                  name: randomMember.name,
                  member_id: randomMember.id
                });
              }
            }
          }
        }
      }

      await fetchSchedule();
    } catch (error) {
      console.error('Erro no preenchimento automático:', error);
    } finally {
      setIsAutoFilling(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('worship_user');
    setUser(null);
  };

  const getWeekDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const toggleRoleVisibility = (role: string) => {
    setVisibleRoles(prev => 
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const weekDays = getWeekDays();

  const toggleEditingService = (id: number) => {
    setEditingServices(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const getRoleIcon = (role: string) => {
    if (role.includes('Ministro')) return <Mic2 className="w-4 h-4" />;
    if (role.includes('Bateria')) return <Drum className="w-4 h-4" />;
    if (role.includes('Teclado')) return <Music className="w-4 h-4" />;
    if (role.includes('Baixo')) return <Music className="w-4 h-4" />;
    if (role.includes('Guitarra')) return <Guitar className="w-4 h-4" />;
    if (role.includes('Violão')) return <Guitar className="w-4 h-4" />;
    return <Users className="w-4 h-4" />;
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-slate-200 overflow-hidden"
        >
          <div className="p-8 bg-indigo-600 text-white text-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <Music className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold">Escala Louvor</h1>
            <p className="text-indigo-100 text-sm mt-1">Acesse sua conta para continuar</p>
          </div>
          
          <form 
            className="p-8 space-y-6"
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const username = formData.get('username') as string;
              const password = formData.get('password') as string;
              
              try {
                const res = await fetch('/api/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ username, password })
                });
                
                if (res.ok) {
                  const userData = await res.json();
                  localStorage.setItem('worship_user', JSON.stringify(userData));
                  setUser(userData);
                } else {
                  const data = await res.json();
                  alert(data.error || 'Erro ao fazer login');
                }
              } catch (error) {
                alert('Erro ao conectar com o servidor');
              }
            }}
          >
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-indigo-600" />
                Usuário
              </label>
              <input 
                name="username"
                type="text" 
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Seu usuário"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-600" />
                Senha
              </label>
              <input 
                name="password"
                type="password" 
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Sua senha"
              />
            </div>
            
            <button 
              type="submit"
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              Entrar no Sistema
            </button>

            <div className="pt-4 text-center">
              <p className="text-xs text-slate-400">
                Dica: Use <b>admin</b> ou <b>membro</b> para testar.
              </p>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-slate-50 flex-col lg:flex-row overflow-hidden">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
          <Music className="w-6 h-6" />
          Escala Louvor
        </h1>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
        >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col z-50 transition-transform duration-300 transform
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen
      `}>
        <div className="p-6 border-b border-slate-100 hidden lg:block">
          <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
            <Music className="w-6 h-6" />
            Escala Louvor
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => {
              setActiveTab('schedule');
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'schedule' ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Calendar className="w-5 h-5" />
            Escalas
          </button>
          {user.role === 'admin' && (
            <button 
              onClick={() => {
                setActiveTab('members');
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'members' ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Users className="w-5 h-5" />
              Cadastro de Membros
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{user.name}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">{user.role === 'admin' ? 'Admin' : 'Membro'}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>

          {user.role === 'admin' && (
            <div className="bg-slate-50 p-4 rounded-xl space-y-2">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Backup</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <p className="text-sm font-medium text-slate-700">Ativo</p>
                </div>
              </div>
              <a 
                href="/api/backup" 
                download
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-all"
              >
                <FileDown className="w-3.5 h-3.5 text-indigo-600" />
                Baixar Backup
              </a>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-all"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-600" />
                Importar Backup
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleRestoreBackup} 
                className="hidden" 
                accept=".db"
              />
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'schedule' ? (
            <motion.div 
              key="schedule"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Escala Semanal</h2>
                  <p className="text-slate-500">Gerencie quem toca em cada culto.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    <button 
                      onClick={() => handleSetViewMode('week')}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'week' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      Semana
                    </button>
                    <button 
                      onClick={() => handleSetViewMode('month')}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'month' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      Mês
                    </button>
                  </div>

                  {user.role === 'admin' && (
                    <button 
                      onClick={handleAutoFill}
                      disabled={isAutoFilling}
                      className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50"
                      title="Preencher Automaticamente"
                    >
                      {isAutoFilling ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      <span className="hidden sm:inline">Auto-Preencher</span>
                    </button>
                  )}

                  {viewMode === 'month' && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 bg-white text-slate-600 border border-slate-200 px-3 py-1.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all shadow-sm"
                        title="Exportar PDF"
                      >
                        <FileDown className="w-4 h-4 text-indigo-600" />
                        <span className="hidden md:inline">PDF</span>
                      </button>
                      
                      <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                        <button 
                          onClick={() => setMonthViewMode('calendar')}
                          className={`p-1.5 rounded-lg transition-all ${monthViewMode === 'calendar' ? 'bg-slate-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
                          title="Calendário"
                        >
                          <Calendar className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setMonthViewMode('list')}
                          className={`p-1.5 rounded-lg transition-all ${monthViewMode === 'list' ? 'bg-slate-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
                          title="Lista"
                        >
                          <LayoutDashboard className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    <button 
                      onClick={() => {
                        console.log('Navigating back', { viewMode });
                        if (viewMode === 'week') {
                          const newWeekStart = new Date(currentWeekStart);
                          newWeekStart.setDate(newWeekStart.getDate() - 7);
                          setCurrentWeekStart(newWeekStart);
                          setCurrentMonth(new Date(newWeekStart.getFullYear(), newWeekStart.getMonth(), 1));
                        } else {
                          const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
                          setCurrentMonth(newMonth);
                          
                          const weekStart = new Date(newMonth);
                          const day = weekStart.getDay();
                          const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
                          weekStart.setDate(diff);
                          setCurrentWeekStart(weekStart);
                        }
                      }}
                      className="p-2 hover:bg-slate-50 rounded-lg text-slate-600"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="px-4 font-medium text-slate-700 min-w-[140px] text-center">
                      {viewMode === 'week' ? (
                        `${currentWeekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} - ${new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
                      ) : (
                        currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                      )}
                    </span>
                    <button 
                      onClick={() => {
                        console.log('Navigating forward', { viewMode });
                        if (viewMode === 'week') {
                          const newWeekStart = new Date(currentWeekStart);
                          newWeekStart.setDate(newWeekStart.getDate() + 7);
                          setCurrentWeekStart(newWeekStart);
                          setCurrentMonth(new Date(newWeekStart.getFullYear(), newWeekStart.getMonth(), 1));
                        } else {
                          const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
                          setCurrentMonth(newMonth);
                          
                          const weekStart = new Date(newMonth);
                          const day = weekStart.getDay();
                          const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
                          weekStart.setDate(diff);
                          setCurrentWeekStart(weekStart);
                        }
                      }}
                      className="p-2 hover:bg-slate-50 rounded-lg text-slate-600"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {viewMode === 'week' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                  {weekDays.map(day => {
                    const dateStr = formatLocalDate(day);
                    const dayName = day.toLocaleDateString('pt-BR', { weekday: 'long' });
                    const isRelevantDay = dayName.includes('quarta') || dayName.includes('sexta') || dayName.includes('domingo');
                    
                    if (!isRelevantDay) return null;

                    const types = dayName.includes('domingo') ? ['Domingo Manhã', 'Domingo Noite'] : 
                                  dayName.includes('quarta') ? ['Quarta'] : ['Sexta'];

                    return types.map(type => {
                      const service = schedule.find(s => s.date === dateStr && s.type === type);
                      const isEditing = service && editingServices.includes(service.id);
                      
                      return (
                        <div key={`${dateStr}-${type}`} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col group/card">
                          <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-start">
                            <div>
                              <h3 className="font-bold text-slate-900 capitalize">{dayName}</h3>
                              <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wider">{type}</p>
                              <p className="text-xs text-slate-400 mt-1">{day.toLocaleDateString('pt-BR')}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              {service && !isEditing && user.role === 'admin' && (
                                <button 
                                  onClick={() => toggleEditingService(service.id)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                  title="Editar Escala"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              )}
                              {service && user.role === 'admin' && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteService(service.id);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                  title="Excluir Escala"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {!service ? (
                            user.role === 'admin' ? (
                              <div className="p-8 flex flex-col items-center justify-center text-center space-y-3 flex-1">
                                <Calendar className="w-8 h-8 text-slate-300" />
                                <p className="text-sm text-slate-500">Sem escala criada</p>
                                <button 
                                  onClick={() => createService(dateStr, type)}
                                  className="w-full text-xs bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2"
                                >
                                  <Plus className="w-4 h-4" />
                                  Criar Escala
                                </button>
                              </div>
                            ) : (
                              <div className="p-8 flex flex-col items-center justify-center text-center space-y-3 flex-1">
                                <Calendar className="w-8 h-8 text-slate-200" />
                                <p className="text-sm text-slate-400 italic">Escala não definida</p>
                              </div>
                            )
                          ) : isEditing && user.role === 'admin' ? (
                            <div className="p-4 space-y-4 flex-1">
                              {SCHEDULE_ROLES.filter(role => visibleRoles.includes(role)).map(role => {
                                const assignment = service.assignments.find(a => a.role === role);
                                const isDuplicate = assignment?.member_id && service.assignments.filter(a => a.member_id === assignment.member_id).length > 1;
                                
                                return (
                                  <div key={role} className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center justify-between">
                                      <span className="flex items-center gap-1">
                                        {getRoleIcon(role)}
                                        {role}
                                      </span>
                                      {isDuplicate && (
                                        <span className="text-[9px] text-yellow-600 font-black animate-pulse">DUPLICADO</span>
                                      )}
                                    </label>
                                    <select 
                                      value={assignment?.member_id || ''}
                                      onChange={(e) => handleAssign(service.id, role, e.target.value ? parseInt(e.target.value) : null)}
                                      className={`w-full text-sm rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all border ${
                                        isDuplicate 
                                          ? 'bg-yellow-50 border-yellow-400 text-yellow-900' 
                                          : 'bg-slate-50 border-slate-200 text-slate-900'
                                      }`}
                                    >
                                      <option value="">Selecione...</option>
                                      {members
                                        .filter(m => {
                                          const memberRoles = m.roles.split(',').filter(r => r);
                                          if (role.startsWith('Backing Vocal')) {
                                            return memberRoles.includes('Backing') || m.roles === '';
                                          }
                                          return memberRoles.includes(role) || m.roles === '';
                                        })
                                        .map(m => (
                                          <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                  </div>
                                );
                              })}
                              <button 
                                onClick={() => toggleEditingService(service.id)}
                                className="w-full mt-4 bg-indigo-600 text-white py-2 rounded-xl text-sm font-bold shadow-md hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                              >
                                <Save className="w-4 h-4" />
                                Confirmar Escala
                              </button>
                            </div>
                          ) : (
                            <div className="p-4 space-y-2 flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Integrantes</span>
                                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Confirmada</span>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                {service.assignments.length === 0 ? (
                                  <p className="text-xs text-slate-400 italic">Nenhum integrante escalado.</p>
                                ) : (
                                  sortAssignments(service.assignments).map(a => (
                                    <div key={a.id} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                                      <div className="flex items-center gap-2">
                                        <div className="text-indigo-600">
                                          {getRoleIcon(a.role)}
                                        </div>
                                        <div>
                                          <p className="text-[10px] text-slate-400 font-bold uppercase leading-none mb-0.5">{a.role}</p>
                                          <p className="text-sm text-slate-700 font-medium leading-none">{a.name}</p>
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })}
                </div>
              ) : monthViewMode === 'calendar' ? (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="grid grid-cols-7 border-b border-slate-100">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                      <div key={day} className="py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {(() => {
                      const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
                      const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
                      const daysInMonth = lastDay.getDate();
                      const startingDay = firstDay.getDay();
                      
                      const cells = [];
                      // Empty cells for previous month
                      for (let i = 0; i < startingDay; i++) {
                        cells.push(<div key={`empty-${i}`} className="h-32 border-r border-b border-slate-50 bg-slate-50/30" />);
                      }
                      
                      // Days of current month
                      for (let d = 1; d <= daysInMonth; d++) {
                        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
                        const dateStr = formatLocalDate(date);
                        const dayServices = schedule.filter(s => s.date === dateStr);
                        const isToday = formatLocalDate(new Date()) === dateStr;
                        
                        cells.push(
                          <div key={d} className={`h-24 sm:h-32 border-r border-b border-slate-100 p-1 sm:p-2 flex flex-col gap-1 hover:bg-slate-50 transition-colors group ${isToday ? 'bg-indigo-50/30' : ''}`}>
                            <span className={`text-xs sm:text-sm font-bold ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>
                              {d}
                            </span>
                            <div className="flex-1 overflow-y-auto space-y-1">
                              {dayServices.map(service => (
                                <div 
                                  key={service.id} 
                                  className="group/item relative"
                                >
                                  <div 
                                    onClick={() => {
                                      setCurrentWeekStart(() => {
                                        const d = new Date(service.date);
                                        const day = d.getDay();
                                        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                                        return new Date(d.setDate(diff));
                                      });
                                      setViewMode('week');
                                    }}
                                    className="text-[10px] bg-indigo-100 text-indigo-700 p-1.5 rounded-lg font-bold cursor-pointer hover:bg-indigo-200 transition-all truncate pr-6"
                                  >
                                    {service.type}
                                  </div>
                                  {user.role === 'admin' && (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteService(service.id);
                                      }}
                                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-indigo-400 hover:text-red-500 transition-all"
                                      title="Excluir"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                              {dayServices.length === 0 && user.role === 'admin' && (
                                <div className="flex md:hidden group-hover:flex items-center justify-center h-full">
                                  <button 
                                    onClick={() => {
                                      const dayName = date.toLocaleDateString('pt-BR', { weekday: 'long' });
                                      const isRelevant = dayName.includes('quarta') || dayName.includes('sexta') || dayName.includes('domingo');
                                      if (isRelevant) {
                                        const type = dayName.includes('domingo') ? 'Domingo Manhã' : 
                                                     dayName.includes('quarta') ? 'Quarta' : 'Sexta';
                                        createService(dateStr, type);
                                      }
                                    }}
                                    className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded-md md:bg-transparent md:text-slate-400 md:hover:text-indigo-600"
                                  >
                                    + Escala
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      
                      // Fill remaining cells
                      const totalCells = startingDay + daysInMonth;
                      const remaining = (7 - (totalCells % 7)) % 7;
                      for (let i = 0; i < remaining; i++) {
                        cells.push(<div key={`empty-end-${i}`} className="h-24 sm:h-32 border-r border-b border-slate-50 bg-slate-50/30" />);
                      }
                      
                      return cells;
                    })()}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Buscar por nome do integrante na escala..."
                      value={scheduleSearchTerm}
                      onChange={(e) => setScheduleSearchTerm(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                    />
                  </div>

                  {schedule.filter(service => 
                    scheduleSearchTerm === '' || 
                    service.assignments.some(a => a.name.toLowerCase().includes(scheduleSearchTerm.toLowerCase()))
                  ).length === 0 ? (
                    <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-4">
                      <LayoutDashboard className="w-12 h-12 text-slate-200 mx-auto" />
                      <p className="text-slate-500">
                        {scheduleSearchTerm ? `Nenhum integrante encontrado com o nome "${scheduleSearchTerm}" neste mês.` : 'Nenhum culto agendado para este mês.'}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Data</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Culto</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Equipe</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {schedule
                            .filter(service => 
                              scheduleSearchTerm === '' || 
                              service.assignments.some(a => a.name.toLowerCase().includes(scheduleSearchTerm.toLowerCase()))
                            )
                            .map(service => (
                            <tr key={service.id} className="hover:bg-slate-50/50 transition-colors group">
                              <td className="px-6 py-4">
                                <div className="font-bold text-slate-900">
                                  {new Date(service.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                </div>
                                <div className="text-xs text-slate-400 capitalize">
                                  {new Date(service.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                  {service.type}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-wrap gap-1 max-w-md">
                                  {service.assignments.length > 0 ? (
                                    sortAssignments(service.assignments).slice(0, 3).map(a => (
                                      <span key={a.id} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                                        {a.name} ({a.role})
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-slate-400 italic">Ninguém escalado</span>
                                  )}
                                  {service.assignments.length > 3 && (
                                    <span className="text-[10px] text-slate-400">+{service.assignments.length - 3} mais</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                  <button 
                                    onClick={() => {
                                      setCurrentWeekStart(() => {
                                        const d = new Date(service.date);
                                        const day = d.getDay();
                                        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                                        return new Date(d.setDate(diff));
                                      });
                                      setViewMode('week');
                                    }}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                    title="Ver Detalhes"
                                  >
                                    <Eye className="w-5 h-5" />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteService(service.id)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="members"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Membros do Grupo</h2>
                  <p className="text-slate-500">Cadastre e gerencie os integrantes e suas funções.</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsShowingStats(true)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white text-slate-600 border border-slate-200 px-4 py-2.5 rounded-xl font-medium hover:bg-slate-50 transition-all shadow-sm"
                  >
                    <BarChart2 className="w-5 h-5 text-indigo-600" />
                    <span className="sm:inline">Estatísticas</span>
                  </button>
                  <button 
                    onClick={() => setIsAddingMember(true)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
                  >
                    <Plus className="w-5 h-5" />
                    Novo Membro
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Buscar membro pelo nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                />
              </div>

              {/* Members List */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {members
                  .filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map(member => (
                  <div key={member.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm group hover:border-indigo-200 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-xl">
                        {member.name.charAt(0)}
                      </div>
                      <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => handleEditMember(member)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          <Pencil className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteMember(member.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{member.name}</h3>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      {member.only_sundays === 1 && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-1 rounded-md flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Apenas Domingos
                        </span>
                      )}
                      {member.is_active === 0 && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 px-2 py-1 rounded-md flex items-center gap-1">
                          <X className="w-3 h-3" />
                          Escala Pausada
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {member.roles.split(',').filter(r => r).map(role => (
                        <span key={role} className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                          {role}
                        </span>
                      ))}
                      {member.roles === '' && <span className="text-xs text-slate-400 italic">Nenhuma função definida</span>}
                    </div>
                  </div>
                ))}
              </div>

              {members.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-4">
                  <Search className="w-12 h-12 text-slate-200 mx-auto" />
                  <p className="text-slate-500">Nenhum membro encontrado com o nome "{searchTerm}".</p>
                </div>
              )}

              {/* Member Statistics Modal */}
              <AnimatePresence>
                {isShowingStats && (
                  <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                    >
                      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <div>
                          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <BarChart2 className="w-6 h-6 text-indigo-600" />
                            Relatório Mensal
                          </h3>
                          <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-widest">
                            {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                          </p>
                        </div>
                        <button onClick={() => setIsShowingStats(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400">
                          <X className="w-6 h-6" />
                        </button>
                      </div>
                      
                      <div className="p-6 space-y-6 overflow-y-auto flex-1">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200">
                            <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest">Total de Membros</p>
                            <h4 className="text-4xl font-black mt-1">{members.length}</h4>
                          </div>
                          <div className="bg-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200">
                            <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest">Cultos no Mês</p>
                            <h4 className="text-4xl font-black mt-1">{reportSchedule.length}</h4>
                          </div>
                        </div>
                        
                        {/* Participation Stats */}
                        <div className="space-y-4">
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                            <Users className="w-4 h-4 text-indigo-600" />
                            Participação dos Membros
                          </h4>
                          
                          <div className="grid grid-cols-1 gap-3">
                            {members.map(member => {
                              const participations = reportSchedule.flatMap(s => 
                                s.assignments
                                  .filter(a => a.member_id === member.id)
                                  .map(a => ({ date: s.date, role: a.role, type: s.type }))
                              );
                              
                              if (participations.length === 0) return null;

                              return (
                                <div key={member.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <h5 className="font-bold text-slate-900">{member.name}</h5>
                                      <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">
                                        {participations.length} {participations.length === 1 ? 'Participação' : 'Participações'}
                                      </p>
                                    </div>
                                    <div className="flex -space-x-2">
                                      {Array.from<string>(new Set(participations.map(p => p.role))).map(role => (
                                        <div key={role} className="bg-white p-1.5 rounded-full border border-slate-200 shadow-sm" title={role}>
                                          {getRoleIcon(role)}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  
                                  <div className="flex flex-wrap gap-2">
                                    {participations.map((p, idx) => (
                                      <div key={idx} className="bg-white px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-medium text-slate-600">
                                        <span className="font-bold text-indigo-600">{new Date(p.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span> - {p.type} ({p.role})
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Not in Schedule */}
                        <div className="space-y-4">
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                            <UserMinus className="w-4 h-4 text-red-500" />
                            Fora da Escala (Mês)
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {members.filter(m => !reportSchedule.some(s => s.assignments.some(a => a.member_id === m.id))).length === 0 ? (
                              <p className="text-xs text-slate-400 italic">Todos os membros estão escalados!</p>
                            ) : (
                              members
                                .filter(m => !reportSchedule.some(s => s.assignments.some(a => a.member_id === m.id)))
                                .map(m => (
                                  <div key={m.id} className="bg-red-50 text-red-700 px-3 py-1.5 rounded-xl border border-red-100 text-xs font-bold">
                                    {m.name}
                                  </div>
                                ))
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-slate-50 border-t border-slate-100">
                        <button 
                          onClick={() => setIsShowingStats(false)}
                          className="w-full bg-slate-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-300 transition-all"
                        >
                          Fechar Relatório
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Add Member Modal */}
              <AnimatePresence>
                {isAddingMember && (
                  <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
                    >
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-xl font-bold text-slate-900">
                        {editingMember ? 'Editar Membro' : 'Novo Membro'}
                      </h3>
                      <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                    <form onSubmit={handleAddMember} className="p-6 space-y-6">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Nome Completo</label>
                        <input 
                          autoFocus
                          type="text" 
                          value={newMemberName}
                          onChange={(e) => setNewMemberName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          placeholder="Ex: João Silva"
                        />
                      </div>
                      
                      <div className="space-y-3">
                        <label className="text-sm font-semibold text-slate-700">Funções / Instrumentos</label>
                        <div className="grid grid-cols-2 gap-2">
                          {MEMBER_ROLES.map(role => (
                            <label key={role} className="flex items-center gap-2 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-all">
                              <input 
                                type="checkbox" 
                                checked={selectedRoles.includes(role)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedRoles([...selectedRoles, role]);
                                  else setSelectedRoles(selectedRoles.filter(r => r !== role));
                                }}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="text-sm text-slate-600">{role}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-semibold text-slate-700">Disponibilidade e Status</label>
                        <div className="grid grid-cols-1 gap-3">
                          <label className="flex items-center gap-3 p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-all group">
                            <div className={`w-10 h-6 rounded-full transition-colors relative ${onlySundays ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                              <input 
                                type="checkbox" 
                                checked={onlySundays}
                                onChange={(e) => setOnlySundays(e.target.checked)}
                                className="sr-only"
                              />
                              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${onlySundays ? 'translate-x-4' : ''}`} />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-slate-700">Apenas aos Domingos</p>
                              <p className="text-[10px] text-slate-400">Não escalar este membro em cultos de Quarta ou Sexta.</p>
                            </div>
                          </label>

                          <label className="flex items-center gap-3 p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-all group">
                            <div className={`w-10 h-6 rounded-full transition-colors relative ${isActive ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                              <input 
                                type="checkbox" 
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                                className="sr-only"
                              />
                              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${isActive ? 'translate-x-4' : ''}`} />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-slate-700">Membro Ativo</p>
                              <p className="text-[10px] text-slate-400">Desmarque para pausar as escalas deste membro temporariamente.</p>
                            </div>
                          </label>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <button 
                          type="button"
                          onClick={closeModal}
                          className="flex-1 px-4 py-3 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition-all"
                        >
                          Cancelar
                        </button>
                        <button 
                          type="submit"
                          className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                        >
                          <Save className="w-5 h-5" />
                          Salvar
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      </main>
    </div>
  );
}
