
import React, { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'oyun_grubu_app_v1';
const sessionOptions = ['10:00-12:00', '13:00-15:00'];
const expenseTypes = ['Fatura', 'Maaş', 'Market', 'Kırtasiye', 'Kira', 'Muhasebe', 'Vergi', 'Stopaj', 'Diğer'];
const weekdays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cts'];
const monthWeekdays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cts', 'Paz'];
const initialData = { parents: [], children: [], payments: [], sessions: [], expenses: [] };

function uid(prefix) { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function startOfWeek(dateStr) { const d = new Date(dateStr || todayStr()); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return d.toISOString().slice(0, 10); }
function addDays(dateStr, days) { const d = new Date(dateStr); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
function formatDate(dateStr) { return dateStr ? new Date(dateStr).toLocaleDateString('tr-TR') : ''; }

function Field({ label, children }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}
function StatCard({ title, value }) {
  return <div className="card stat"><div className="label">{title}</div><div className="value">{value}</div></div>;
}

export default function App() {
  const [data, setData] = useState(initialData);
  const [selectedParentId, setSelectedParentId] = useState('');
  const [weekStart, setWeekStart] = useState(startOfWeek(todayStr()));
  const [monthRef, setMonthRef] = useState(todayStr().slice(0, 7) + '-01');
  const [activeTab, setActiveTab] = useState('kayit');
  const [parentForm, setParentForm] = useState({ parentName: '', phone: '', childName: '' });
  const [paymentForm, setPaymentForm] = useState({ childId: '', sessionCount: '', amount: '', date: todayStr() });
  const [sessionForm, setSessionForm] = useState({ childId: '', date: todayStr(), time: sessionOptions[0] });
  const [attendanceForm, setAttendanceForm] = useState({ sessionId: '', attended: true, lostRight: false });
  const [expenseForm, setExpenseForm] = useState({ date: todayStr(), type: expenseTypes[0], amount: '', note: '' });

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setData({ ...initialData, ...parsed });
        if (parsed.parents?.[0]?.id) setSelectedParentId(parsed.parents[0].id);
      } catch {}
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const selectedParent = useMemo(() => data.parents.find((p) => p.id === selectedParentId) || null, [data.parents, selectedParentId]);
  const parentChildren = useMemo(() => data.children.filter((c) => c.parentId === selectedParentId), [data.children, selectedParentId]);

  const childStats = useMemo(() => {
    const map = {};
    data.children.forEach((child) => {
      const totalPaid = data.payments.filter((p) => p.childId === child.id).reduce((s, x) => s + Number(x.sessionCount || 0), 0);
      const used = data.sessions.filter((s) => s.childId === child.id && (s.status === 'Geldi' || (s.status === 'Gelmedi' && s.lostRight))).length;
      map[child.id] = { totalPaid, used, remaining: totalPaid - used };
    });
    return map;
  }, [data]);

  const totalIncome = useMemo(() => data.payments.reduce((s, x) => s + Number(x.amount || 0), 0), [data.payments]);
  const totalExpense = useMemo(() => data.expenses.reduce((s, x) => s + Number(x.amount || 0), 0), [data.expenses]);

  const weeklyGrid = useMemo(() => {
    const grid = {};
    weekdays.forEach((_, idx) => {
      const date = addDays(weekStart, idx);
      sessionOptions.forEach((time) => {
        grid[`${date}|${time}`] = data.sessions.filter((s) => s.date === date && s.time === time);
      });
    });
    return grid;
  }, [data.sessions, weekStart]);

  const monthlyCells = useMemo(() => {
    const ref = new Date(monthRef);
    const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const firstWeekday = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
    const cells = Array(42).fill(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(ref.getFullYear(), ref.getMonth(), day);
      const iso = d.toISOString().slice(0, 10);
      cells[firstWeekday + day - 1] = {
        day,
        date: iso,
        morning: data.sessions.filter((s) => s.date === iso && s.time === sessionOptions[0]),
        noon: data.sessions.filter((s) => s.date === iso && s.time === sessionOptions[1]),
      };
    }
    return cells;
  }, [data.sessions, monthRef]);

  const availableSessionsForAttendance = useMemo(() =>
    data.sessions.map((s) => {
      const child = data.children.find((c) => c.id === s.childId);
      return { ...s, childName: child?.name || 'Bilinmiyor' };
    }).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)), [data.sessions, data.children]
  );

  function addRegistration() {
    const parentName = parentForm.parentName.trim();
    const phone = parentForm.phone.trim();
    const childName = parentForm.childName.trim();
    if (!parentName || !childName) return;

    let parent = data.parents.find((p) => p.name.toLowerCase() === parentName.toLowerCase());
    let newParents = [...data.parents];
    if (!parent) {
      parent = { id: uid('parent'), name: parentName, phone };
      newParents.push(parent);
    } else if (phone && parent.phone !== phone) {
      newParents = newParents.map((p) => p.id === parent.id ? { ...p, phone } : p);
    }

    const exists = data.children.some((c) => c.parentId === parent.id && c.name.toLowerCase() === childName.toLowerCase());
    if (exists) return;

    const child = { id: uid('child'), parentId: parent.id, name: childName };
    setData((prev) => ({ ...prev, parents: newParents, children: [...prev.children, child] }));
    setSelectedParentId(parent.id);
    setParentForm({ parentName: '', phone: '', childName: '' });
  }

  function addPayment() {
    if (!paymentForm.childId || !paymentForm.sessionCount || !paymentForm.amount) return;
    setData((prev) => ({
      ...prev,
      payments: [...prev.payments, { id: uid('pay'), childId: paymentForm.childId, sessionCount: Number(paymentForm.sessionCount), amount: Number(paymentForm.amount), date: paymentForm.date }],
    }));
    setPaymentForm({ childId: '', sessionCount: '', amount: '', date: todayStr() });
  }

  function addSession() {
    if (!sessionForm.childId || !sessionForm.date || !sessionForm.time) return;
    setData((prev) => ({
      ...prev,
      sessions: [...prev.sessions, { id: uid('session'), childId: sessionForm.childId, date: sessionForm.date, time: sessionForm.time, status: 'Planlandı', lostRight: false }],
    }));
  }

  function saveAttendance() {
    if (!attendanceForm.sessionId) return;
    setData((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => s.id === attendanceForm.sessionId ? { ...s, status: attendanceForm.attended ? 'Geldi' : 'Gelmedi', lostRight: attendanceForm.lostRight } : s),
    }));
  }

  function addExpense() {
    if (!expenseForm.amount || !expenseForm.type) return;
    setData((prev) => ({
      ...prev,
      expenses: [...prev.expenses, { id: uid('expense'), date: expenseForm.date, type: expenseForm.type, amount: Number(expenseForm.amount), note: expenseForm.note }],
    }));
    setExpenseForm({ date: todayStr(), type: expenseTypes[0], amount: '', note: '' });
  }

  function resetAll() {
    if (!window.confirm('Tüm veriler silinsin mi?')) return;
    setData(initialData);
    setSelectedParentId('');
  }

  return (
    <div className="page">
      <div className="header">
        <div>
          <h1>Oyun Grubu Yönetim Uygulaması</h1>
          <p className="sub">Tek ekrandan kayıt, ödeme, seans, yoklama, gider ve planlama yönetimi</p>
        </div>
        <div className="buttonRow">
          <button className="button secondary" onClick={() => window.location.reload()}>Yenile</button>
          <button className="button danger" onClick={resetAll}>Tüm Veriyi Sıfırla</button>
        </div>
      </div>

      <div className="stats">
        <StatCard title="Toplam Öğrenci" value={data.children.length} />
        <StatCard title="Toplam Gelir" value={`${totalIncome.toLocaleString('tr-TR')} ₺`} />
        <StatCard title="Toplam Gider" value={`${totalExpense.toLocaleString('tr-TR')} ₺`} />
        <StatCard title="Net" value={`${(totalIncome - totalExpense).toLocaleString('tr-TR')} ₺`} />
      </div>

      <div className="layout">
        <div>
          <div className="card panel">
            <h2>İşlem Paneli</h2>
            <div className="tabs">
              {[['kayit','Kayıt'],['odeme','Ödeme'],['seans','Seans'],['yoklama','Yoklama'],['gider','Gider']].map(([key,label]) => (
                <button key={key} className={`tab ${activeTab === key ? 'active' : ''}`} onClick={() => setActiveTab(key)}>{label}</button>
              ))}
            </div>

            {activeTab === 'kayit' && <>
              <Field label="Veli Adı"><input className="input" value={parentForm.parentName} onChange={(e) => setParentForm({ ...parentForm, parentName: e.target.value })} /></Field>
              <Field label="Telefon"><input className="input" value={parentForm.phone} onChange={(e) => setParentForm({ ...parentForm, phone: e.target.value })} /></Field>
              <Field label="Çocuk Adı"><input className="input" value={parentForm.childName} onChange={(e) => setParentForm({ ...parentForm, childName: e.target.value })} /></Field>
              <button className="button" onClick={addRegistration}>Kaydet</button>
            </>}

            {activeTab === 'odeme' && <>
              <Field label="Çocuk">
                <select className="select" value={paymentForm.childId} onChange={(e) => setPaymentForm({ ...paymentForm, childId: e.target.value })}>
                  <option value="">Çocuk seç</option>
                  {data.children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Seans Sayısı"><input className="input" type="number" value={paymentForm.sessionCount} onChange={(e) => setPaymentForm({ ...paymentForm, sessionCount: e.target.value })} /></Field>
              <Field label="Tutar"><input className="input" type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} /></Field>
              <Field label="Tarih"><input className="input" type="date" value={paymentForm.date} onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })} /></Field>
              <button className="button" onClick={addPayment}>Ödeme Kaydet</button>
            </>}

            {activeTab === 'seans' && <>
              <Field label="Çocuk">
                <select className="select" value={sessionForm.childId} onChange={(e) => setSessionForm({ ...sessionForm, childId: e.target.value })}>
                  <option value="">Çocuk seç</option>
                  {data.children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Tarih"><input className="input" type="date" value={sessionForm.date} onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })} /></Field>
              <Field label="Saat">
                <select className="select" value={sessionForm.time} onChange={(e) => setSessionForm({ ...sessionForm, time: e.target.value })}>
                  {sessionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <button className="button" onClick={addSession}>Seans Planla</button>
            </>}

            {activeTab === 'yoklama' && <>
              <Field label="Seans">
                <select className="select" value={attendanceForm.sessionId} onChange={(e) => setAttendanceForm({ ...attendanceForm, sessionId: e.target.value })}>
                  <option value="">Seans seç</option>
                  {availableSessionsForAttendance.map((s) => <option key={s.id} value={s.id}>{`${formatDate(s.date)} • ${s.time} • ${s.childName}`}</option>)}
                </select>
              </Field>
              <div className="checkbox-row"><span>Geldi mi?</span><input type="checkbox" checked={attendanceForm.attended} onChange={(e) => setAttendanceForm({ ...attendanceForm, attended: e.target.checked })} /></div>
              <div className="checkbox-row"><span>Hak kaybı?</span><input type="checkbox" checked={attendanceForm.lostRight} onChange={(e) => setAttendanceForm({ ...attendanceForm, lostRight: e.target.checked })} /></div>
              <button className="button" onClick={saveAttendance}>Yoklama Kaydet</button>
            </>}

            {activeTab === 'gider' && <>
              <Field label="Tarih"><input className="input" type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} /></Field>
              <Field label="Tür">
                <select className="select" value={expenseForm.type} onChange={(e) => setExpenseForm({ ...expenseForm, type: e.target.value })}>
                  {expenseTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Tutar"><input className="input" type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} /></Field>
              <Field label="Açıklama"><textarea className="textarea" value={expenseForm.note} onChange={(e) => setExpenseForm({ ...expenseForm, note: e.target.value })} /></Field>
              <button className="button" onClick={addExpense}>Gider Kaydet</button>
            </>}
          </div>

          <div className="card panel" style={{ marginTop: 20 }}>
            <h2>Veli Paneli</h2>
            <Field label="Veli Seç">
              <select className="select" value={selectedParentId} onChange={(e) => setSelectedParentId(e.target.value)}>
                <option value="">Veli seç</option>
                {data.parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            {selectedParent ? <>
              <div className="parent-card">
                <div style={{ fontWeight: 700 }}>{selectedParent.name}</div>
                <div className="small">{selectedParent.phone || 'Telefon yok'}</div>
              </div>
              {parentChildren.map((child) => (
                <div key={child.id} className="parent-card">
                  <div style={{ fontWeight: 700 }}>{child.name}</div>
                  <div className="badges">
                    <span className="badge">Alınan: {childStats[child.id]?.totalPaid || 0}</span>
                    <span className="badge">Kullanılan: {childStats[child.id]?.used || 0}</span>
                    <span className="badge">Kalan: {childStats[child.id]?.remaining || 0}</span>
                  </div>
                </div>
              ))}
              {!parentChildren.length && <div className="empty">Bu veliye bağlı çocuk yok.</div>}
            </> : <div className="empty">Veli seçildiğinde çocuklar burada görünür.</div>}
          </div>
        </div>

        <div>
          <div className="card content-card">
            <div className="topbar">
              <h2 style={{ margin: 0 }}>Haftalık Seans Çizelgesi</h2>
              <input className="input" style={{ width: 180 }} type="date" value={weekStart} onChange={(e) => setWeekStart(startOfWeek(e.target.value))} />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Saat / Gün</th>
                    {weekdays.map((day, idx) => <th key={day}><div>{day}</div><div className="small">{formatDate(addDays(weekStart, idx))}</div></th>)}
                  </tr>
                </thead>
                <tbody>
                  {sessionOptions.map((time) => (
                    <tr key={time}>
                      <td><strong>{time}</strong></td>
                      {weekdays.map((_, idx) => {
                        const date = addDays(weekStart, idx);
                        const items = weeklyGrid[`${date}|${time}`] || [];
                        return <td key={date + time}>
                          {items.length ? items.map((item) => {
                            const child = data.children.find((c) => c.id === item.childId);
                            return <div className="session-chip" key={item.id}><div className="name">{child?.name}</div><div className="small">{item.status}</div></div>;
                          }) : <span className="empty">-</span>}
                        </td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card content-card" style={{ marginTop: 20 }}>
            <div className="topbar">
              <h2 style={{ margin: 0 }}>Aylık Takvim</h2>
              <input className="input" style={{ width: 180 }} type="month" value={monthRef.slice(0, 7)} onChange={(e) => setMonthRef(e.target.value + '-01')} />
            </div>
            <div className="calendar">
              {monthWeekdays.map((d) => <div key={d} className="cal-head">{d}</div>)}
              {monthlyCells.map((cell, idx) => (
                <div key={idx} className="cal-cell">
                  {cell ? <>
                    <div className="cal-day">{cell.day}</div>
                    {cell.morning.length > 0 && <div className="cal-slot"><div><strong>10:00</strong></div><div>{cell.morning.map((x) => data.children.find((c) => c.id === x.childId)?.name).filter(Boolean).join(', ')}</div></div>}
                    {cell.noon.length > 0 && <div className="cal-slot"><div><strong>13:00</strong></div><div>{cell.noon.map((x) => data.children.find((c) => c.id === x.childId)?.name).filter(Boolean).join(', ')}</div></div>}
                  </> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
