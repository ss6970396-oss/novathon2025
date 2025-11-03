import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

const motivationalQuotes = [
  "Done is better than perfect",
  "Consistency beats intensity",
  "Start where you are. Use what you have. Do what you can.",
  "Small progress is still progress",
  "The best time to start was yesterday. The next best time is now.",
  "You don't have to be great to start, but you have to start to be great",
  "Fall seven times, stand up eight",
  "Every expert was once a beginner",
  "Progress, not perfection",
  "Today's struggle is tomorrow's strength"
];

const goodStreakMemes = [
  { text: "When you complete all habits 3 days in a row", emoji: "😎" },
  { text: "Me after logging my 7th day straight", emoji: "💪" },
  { text: "Look at me, I'm the responsible adult now", emoji: "🎓" },
  { text: "That feeling when your streak is on fire", emoji: "🔥" },
  { text: "POV: You're absolutely crushing it", emoji: "⭐" }
];

const badStreakMemes = [
  { text: "Tomorrow's definitely the day... right?", emoji: "😅" },
  { text: "Me realizing I forgot to log yesterday", emoji: "🤦" },
  { text: "Starting over? We don't know her... yet.", emoji: "😬" },
  { text: "It's fine, streaks are just numbers anyway", emoji: "🙃" },
  { text: "New week, new me (for real this time)", emoji: "🌱" }
];

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [userData, setUserData] = useState(null);
  const [habits, setHabits] = useState([]);
  const [habitLogs, setHabitLogs] = useState([]);
  const [sleepLogs, setSleepLogs] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [carouselContent, setCarouselContent] = useState({ type: 'quote', content: motivationalQuotes[0] });
  const [aiPlan, setAiPlan] = useState('');
  const [aiPlanLoading, setAiPlanLoading] = useState(false);
  const lastReminderCheck = useRef(Date.now());

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        setUser(session.user);
        await loadUserData(session.user.id);
      } else {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        setUser(data.user);
        await createUserProfile(data.user.id);
      }
    } catch (error) {
      console.error('Auth error:', error);
      showToast('Authentication failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const createUserProfile = async (userId) => {
    try {
      const { error } = await supabase
        .from('users')
        .insert([{ id: userId, xp: 0, level: 1, current_streak: 0, max_streak: 0 }]);

      if (error && error.code !== '23505') throw error;
      await loadUserData(userId);
    } catch (error) {
      console.error('Error creating profile:', error);
    }
  };

  const loadUserData = async (userId) => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        await createUserProfile(userId);
        return;
      }

      setUserData(profile);
      setDarkMode(profile.dark_mode || false);

      const { data: habitsData } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      setHabits(habitsData || []);

      const { data: logsData } = await supabase
        .from('habit_logs')
        .select('*')
        .eq('user_id', userId)
        .order('log_date', { ascending: false });

      setHabitLogs(logsData || []);

      const { data: sleepData } = await supabase
        .from('sleep_logs')
        .select('*')
        .eq('user_id', userId)
        .order('log_date', { ascending: false })
        .limit(7);

      setSleepLogs(sleepData || []);

      const { data: timetableData } = await supabase
        .from('timetable_entries')
        .select('*')
        .eq('user_id', userId)
        .order('day', { ascending: true });

      setTimetable(timetableData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const toggleDarkMode = async () => {
    const newMode = !darkMode;
    setDarkMode(newMode);

    if (user) {
      await supabase
        .from('users')
        .update({ dark_mode: newMode })
        .eq('id', user.id);
    }
  };

  const showToast = (message, type = 'success', icon = null) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, icon }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const addXP = async (amount, message = null) => {
    if (!user || !userData) return;

    const newXP = userData.xp + amount;
    const newLevel = Math.floor(newXP / 200) + 1;
    const leveledUp = newLevel > userData.level;

    await supabase
      .from('users')
      .update({ xp: newXP, level: newLevel })
      .eq('id', user.id);

    setUserData(prev => ({ ...prev, xp: newXP, level: newLevel }));

    if (leveledUp) {
      showToast(`🎉 Level Up! You're now Level ${newLevel}! That's how you grind! 💪`, 'success', '🎉');
    } else if (message) {
      showToast(message, 'success', '⚡');
    } else {
      showToast(`+${amount} XP! Keep crushing it! 🔥`, 'success', '⚡');
    }
  };

  const calculateStreak = useCallback(async () => {
    if (!user || habits.length === 0) return;

    const today = new Date().toISOString().split('T')[0];
    const dailyHabits = habits.filter(h => h.frequency === 'Daily');

    if (dailyHabits.length === 0) return;

    let streak = 0;
    let checkDate = new Date();

    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const logsForDate = habitLogs.filter(log => log.log_date === dateStr);

      const completedCount = logsForDate.filter(log => {
        const habit = dailyHabits.find(h => h.id === log.habit_id);
        if (!habit) return false;
        return habit.is_boolean ? log.completed : log.value >= habit.goal_value;
      }).length;

      if (completedCount === dailyHabits.length) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }

      if (streak > 365) break;
    }

    if (streak !== userData.current_streak) {
      const maxStreak = Math.max(streak, userData.max_streak);

      await supabase
        .from('users')
        .update({ current_streak: streak, max_streak: maxStreak })
        .eq('id', user.id);

      setUserData(prev => ({ ...prev, current_streak: streak, max_streak: maxStreak }));

      if (streak === 7) {
        showToast('🔥 7-Day Streak! You absolute legend! Keep the fire burning! 🔥', 'success', '🏆');
      }
    }
  }, [user, habits, habitLogs, userData]);

  useEffect(() => {
    if (user && userData) {
      calculateStreak();
    }
  }, [habitLogs, calculateStreak]);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentStreak = userData?.current_streak || 0;
      const isGoodStreak = currentStreak >= 3;

      const contentType = Math.random() > 0.5 ? 'quote' : 'meme';

      if (contentType === 'quote') {
        const quote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
        setCarouselContent({ type: 'quote', content: quote });
      } else {
        const memePool = isGoodStreak ? goodStreakMemes : badStreakMemes;
        const meme = memePool[Math.floor(Math.random() * memePool.length)];
        setCarouselContent({ type: 'meme', content: meme });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [userData]);

  useEffect(() => {
    if (!user) return;

    const checkReminders = async () => {
      const now = new Date();
      const hour = now.getHours();

      if (hour < 9 || hour > 21) return;

      const timeSinceLastCheck = Date.now() - lastReminderCheck.current;
      if (timeSinceLastCheck < 3600000) return;

      lastReminderCheck.current = Date.now();

      const today = now.toISOString().split('T')[0];
      const dailyHabits = habits.filter(h => h.frequency === 'Daily');

      for (const habit of dailyHabits) {
        const log = habitLogs.find(l => l.habit_id === habit.id && l.log_date === today);
        const isIncomplete = !log || !log.completed || (habit.goal_value && log.value < habit.goal_value);

        if (isIncomplete) {
          const reminder = await generateAIReminder(habit.name);
          if (reminder) {
            showToast(reminder, 'info', '⚡');
          }
          break;
        }
      }
    };

    const reminderInterval = setInterval(checkReminders, 3600000);
    checkReminders();

    return () => clearInterval(reminderInterval);
  }, [user, habits, habitLogs]);

  const generateAIReminder = async (habitName) => {
    try {
      const response = await fetchWithRetry(GEMINI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Generate a short, encouraging reminder (max 15 words) for a college student to complete their habit: "${habitName}". Be friendly and motivating.`
            }]
          }]
        })
      });

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    } catch (error) {
      console.error('AI reminder error:', error);
      return null;
    }
  };

  const fetchWithRetry = async (url, options, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) return response;

        if (response.status === 429 || response.status >= 500) {
          const delay = Math.pow(2, i) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        return response;
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };

  const createHabit = async (habitData) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('habits')
        .insert([{ ...habitData, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      setHabits(prev => [...prev, data]);
      showToast('Habit created successfully!', 'success');
    } catch (error) {
      console.error('Error creating habit:', error);
      showToast('Failed to create habit', 'error');
    }
  };

  const updateHabit = async (habitId, updates) => {
    try {
      const { error } = await supabase
        .from('habits')
        .update(updates)
        .eq('id', habitId);

      if (error) throw error;

      setHabits(prev => prev.map(h => h.id === habitId ? { ...h, ...updates } : h));
      showToast('Habit updated!', 'success');
    } catch (error) {
      console.error('Error updating habit:', error);
      showToast('Failed to update habit', 'error');
    }
  };

  const deleteHabit = async (habitId) => {
    try {
      const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', habitId);

      if (error) throw error;

      setHabits(prev => prev.filter(h => h.id !== habitId));
      showToast('Habit deleted', 'success');
    } catch (error) {
      console.error('Error deleting habit:', error);
      showToast('Failed to delete habit', 'error');
    }
  };

  const logHabit = async (habitId, value = null) => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const habit = habits.find(h => h.id === habitId);

    if (!habit) return;

    try {
      const existingLog = habitLogs.find(l => l.habit_id === habitId && l.log_date === today);

      if (existingLog) {
        const newValue = habit.is_boolean ? !existingLog.completed : (value ?? 0);
        const completed = habit.is_boolean ? !existingLog.completed : newValue >= habit.goal_value;

        const { error } = await supabase
          .from('habit_logs')
          .update({ completed, value: newValue })
          .eq('id', existingLog.id);

        if (error) throw error;

        setHabitLogs(prev => prev.map(l =>
          l.id === existingLog.id ? { ...l, completed, value: newValue } : l
        ));

        if (completed && !existingLog.completed) {
          await addXP(50, `+50 XP! ${habit.name} completed! That's how you grind! 💪`);
        }
      } else {
        const newValue = habit.is_boolean ? 0 : (value ?? 0);
        const completed = habit.is_boolean ? true : newValue >= habit.goal_value;

        const { data, error } = await supabase
          .from('habit_logs')
          .insert([{
            user_id: user.id,
            habit_id: habitId,
            completed,
            value: newValue,
            log_date: today
          }])
          .select()
          .single();

        if (error) throw error;

        setHabitLogs(prev => [data, ...prev]);

        if (completed) {
          await addXP(50, `+50 XP! ${habit.name} completed! That's how you grind! 💪`);
        }
      }
    } catch (error) {
      console.error('Error logging habit:', error);
      showToast('Failed to log habit', 'error');
    }
  };

  const logSleep = async (sleepData) => {
    if (!user) return;

    try {
      const { bedtime, wakeTime, quality } = sleepData;
      const totalHours = calculateSleepHours(bedtime, wakeTime);
      const today = new Date().toISOString().split('T')[0];

      const existingLog = sleepLogs.find(l => l.log_date === today);

      if (existingLog) {
        const { error } = await supabase
          .from('sleep_logs')
          .update({
            bedtime,
            wake_time: wakeTime,
            quality,
            total_hours: totalHours
          })
          .eq('id', existingLog.id);

        if (error) throw error;

        setSleepLogs(prev => prev.map(l =>
          l.id === existingLog.id
            ? { ...l, bedtime, wake_time: wakeTime, quality, total_hours: totalHours }
            : l
        ));
      } else {
        const { data, error } = await supabase
          .from('sleep_logs')
          .insert([{
            user_id: user.id,
            bedtime,
            wake_time: wakeTime,
            quality,
            total_hours: totalHours,
            log_date: today
          }])
          .select()
          .single();

        if (error) throw error;

        setSleepLogs(prev => [data, ...prev]);
        await addXP(10, '+10 XP for logging sleep! Rest is progress too! 😴');
      }

      showToast('Sleep logged successfully!', 'success');
    } catch (error) {
      console.error('Error logging sleep:', error);
      showToast('Failed to log sleep', 'error');
    }
  };

  const calculateSleepHours = (bedtime, wakeTime) => {
    const [bedHour, bedMin] = bedtime.split(':').map(Number);
    const [wakeHour, wakeMin] = wakeTime.split(':').map(Number);

    let bedMinutes = bedHour * 60 + bedMin;
    let wakeMinutes = wakeHour * 60 + wakeMin;

    if (wakeMinutes < bedMinutes) {
      wakeMinutes += 24 * 60;
    }

    return ((wakeMinutes - bedMinutes) / 60).toFixed(1);
  };

  const addTimetableEntry = async (entry) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('timetable_entries')
        .insert([{ ...entry, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      setTimetable(prev => [...prev, data]);
      showToast('Class added to timetable!', 'success');
    } catch (error) {
      console.error('Error adding timetable entry:', error);
      showToast('Failed to add class', 'error');
    }
  };

  const deleteTimetableEntry = async (entryId) => {
    try {
      const { error } = await supabase
        .from('timetable_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      setTimetable(prev => prev.filter(e => e.id !== entryId));
      showToast('Class removed', 'success');
    } catch (error) {
      console.error('Error deleting timetable entry:', error);
      showToast('Failed to remove class', 'error');
    }
  };

  const generateDailyPlan = async () => {
    if (!user) return;

    setAiPlanLoading(true);
    setAiPlan('');

    try {
      const today = new Date();
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];

      const todayClasses = timetable.filter(e => e.day === dayName);
      const dailyHabits = habits.filter(h => h.frequency === 'Daily');

      let prompt = `You are a highly efficient college schedule assistant. Create a realistic, healthy daily schedule for a college student for today (${dayName}).

Classes today:
${todayClasses.length > 0 ? todayClasses.map(c => `- ${c.course}: ${c.start_time} - ${c.end_time}`).join('\n') : '- No classes scheduled'}

Daily habits to incorporate:
${dailyHabits.length > 0 ? dailyHabits.map(h => `- ${h.name}${h.unit ? ` (${h.goal_value} ${h.unit})` : ''}`).join('\n') : '- No habits set'}

Provide a clear, easy-to-read hourly schedule that balances academic time, habits, meals, and rest. Format as time blocks (e.g., "9:00 AM - 10:00 AM: Morning routine"). Keep it concise and realistic.`;

      const response = await fetchWithRetry(GEMINI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      });

      const data = await response.json();
      const plan = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Failed to generate plan';

      setAiPlan(plan);
      showToast('Daily plan generated!', 'success');
    } catch (error) {
      console.error('Error generating plan:', error);
      setAiPlan('Failed to generate plan. Please try again.');
      showToast('Failed to generate plan', 'error');
    } finally {
      setAiPlanLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className={`mt-4 text-lg ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Loading your habits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <Header
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          currentView={currentView}
          setCurrentView={setCurrentView}
          userData={userData}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {currentView === 'dashboard' && (
            <Dashboard
              userData={userData}
              habits={habits}
              habitLogs={habitLogs}
              carouselContent={carouselContent}
              logHabit={logHabit}
              darkMode={darkMode}
            />
          )}

          {currentView === 'habits' && (
            <HabitsView
              habits={habits}
              createHabit={createHabit}
              updateHabit={updateHabit}
              deleteHabit={deleteHabit}
              darkMode={darkMode}
            />
          )}

          {currentView === 'sleep' && (
            <SleepView
              sleepLogs={sleepLogs}
              logSleep={logSleep}
              darkMode={darkMode}
            />
          )}

          {currentView === 'timetable' && (
            <TimetableView
              timetable={timetable}
              addTimetableEntry={addTimetableEntry}
              deleteTimetableEntry={deleteTimetableEntry}
              generateDailyPlan={generateDailyPlan}
              aiPlan={aiPlan}
              aiPlanLoading={aiPlanLoading}
              darkMode={darkMode}
            />
          )}

          {currentView === 'progress' && (
            <ProgressView
              habitLogs={habitLogs}
              habits={habits}
              sleepLogs={sleepLogs}
              darkMode={darkMode}
            />
          )}
        </main>

        <ToastContainer toasts={toasts} darkMode={darkMode} />
      </div>
    </div>
  );
}

function Header({ darkMode, toggleDarkMode, currentView, setCurrentView, userData }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'habits', label: 'Habits', icon: '✅' },
    { id: 'sleep', label: 'Sleep', icon: '😴' },
    { id: 'timetable', label: 'Timetable', icon: '📅' },
    { id: 'progress', label: 'Progress', icon: '📊' },
  ];

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Smart Habit Tracker</h1>
            {userData && (
              <div className="hidden sm:flex items-center space-x-4">
                <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900 rounded-full">
                  <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                    Level {userData.level}
                  </span>
                </div>
                <div className="px-3 py-1 bg-purple-100 dark:bg-purple-900 rounded-full">
                  <span className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                    {userData.xp} XP
                  </span>
                </div>
                <div className="px-3 py-1 bg-orange-100 dark:bg-orange-900 rounded-full">
                  <span className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                    🔥 {userData.current_streak} day streak
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="sm:hidden p-2 rounded-lg bg-gray-100 dark:bg-gray-700"
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        <nav className="hidden sm:flex space-x-2 pb-4">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                currentView === item.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {menuOpen && (
          <nav className="sm:hidden pb-4 space-y-2">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id);
                  setMenuOpen(false);
                }}
                className={`w-full px-4 py-2 rounded-lg font-medium transition-colors text-left ${
                  currentView === item.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

function Dashboard({ userData, habits, habitLogs, carouselContent, logHabit, darkMode }) {
  const today = new Date().toISOString().split('T')[0];
  const dailyHabits = habits.filter(h => h.frequency === 'Daily');

  const getTodayProgress = () => {
    if (dailyHabits.length === 0) return 0;

    const completedCount = dailyHabits.filter(habit => {
      const log = habitLogs.find(l => l.habit_id === habit.id && l.log_date === today);
      if (!log) return false;
      return habit.is_boolean ? log.completed : log.value >= habit.goal_value;
    }).length;

    return Math.round((completedCount / dailyHabits.length) * 100);
  };

  const todayProgress = getTodayProgress();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Daily Progress
          </h3>
          <div className="relative w-32 h-32 mx-auto">
            <svg className="transform -rotate-90 w-32 h-32">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                className="text-gray-200 dark:text-gray-700"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={`${2 * Math.PI * 56}`}
                strokeDashoffset={`${2 * Math.PI * 56 * (1 - todayProgress / 100)}`}
                className="text-blue-600 transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{todayProgress}%</span>
            </div>
          </div>
          <p className="text-center text-gray-600 dark:text-gray-400 mt-4">
            {dailyHabits.length} habits today
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-6 shadow-lg text-white overflow-hidden relative">
          <div className="relative z-10">
            <h3 className="text-lg font-semibold mb-4">
              {carouselContent.type === 'quote' ? '💭 Daily Motivation' : '😄 Mood'}
            </h3>
            {carouselContent.type === 'quote' ? (
              <p className="text-xl font-medium leading-relaxed">
                "{carouselContent.content}"
              </p>
            ) : (
              <div className="space-y-3">
                <div className="text-5xl">{carouselContent.content.emoji}</div>
                <p className="text-lg font-medium">{carouselContent.content.text}</p>
              </div>
            )}
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-10 rounded-full -ml-12 -mb-12"></div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Your Stats
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Level</span>
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {userData?.level || 1}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Total XP</span>
              <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {userData?.xp || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Current Streak</span>
              <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {userData?.current_streak || 0} 🔥
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Max Streak</span>
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                {userData?.max_streak || 0} ⭐
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Today's Habits
        </h3>

        {dailyHabits.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🌱</div>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
              The journey of a thousand miles begins with a single step.
            </p>
            <p className="text-gray-500 dark:text-gray-500">
              Add your first habit to get started!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dailyHabits.map(habit => {
              const log = habitLogs.find(l => l.habit_id === habit.id && l.log_date === today);
              const isCompleted = log && (habit.is_boolean ? log.completed : log.value >= habit.goal_value);
              const currentValue = log?.value || 0;

              return (
                <div
                  key={habit.id}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    isCompleted
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-gray-900 dark:text-white">{habit.name}</h4>
                    {isCompleted && <span className="text-2xl">✅</span>}
                  </div>

                  {habit.is_boolean ? (
                    <button
                      onClick={() => logHabit(habit.id)}
                      className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                        isCompleted
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isCompleted ? 'Completed!' : 'Mark Complete'}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          value={currentValue}
                          onChange={(e) => logHabit(habit.id, parseInt(e.target.value) || 0)}
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="0"
                        />
                        <span className="text-gray-600 dark:text-gray-400">
                          / {habit.goal_value} {habit.unit}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min((currentValue / habit.goal_value) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function HabitsView({ habits, createHabit, updateHabit, deleteHabit, darkMode }) {
  const [showForm, setShowForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    frequency: 'Daily',
    is_boolean: true,
    goal_value: 1,
    unit: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (editingHabit) {
      await updateHabit(editingHabit.id, formData);
      setEditingHabit(null);
    } else {
      await createHabit(formData);
    }

    setFormData({ name: '', frequency: 'Daily', is_boolean: true, goal_value: 1, unit: '' });
    setShowForm(false);
  };

  const startEdit = (habit) => {
    setEditingHabit(habit);
    setFormData({
      name: habit.name,
      frequency: habit.frequency,
      is_boolean: habit.is_boolean,
      goal_value: habit.goal_value,
      unit: habit.unit
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Habits</h2>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingHabit(null);
            setFormData({ name: '', frequency: 'Daily', is_boolean: true, goal_value: 1, unit: '' });
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          {showForm ? 'Cancel' : '+ Add Habit'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            {editingHabit ? 'Edit Habit' : 'Create New Habit'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Habit Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Frequency
              </label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={formData.is_boolean}
                    onChange={() => setFormData({ ...formData, is_boolean: true })}
                    className="mr-2"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Simple check-off</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={!formData.is_boolean}
                    onChange={() => setFormData({ ...formData, is_boolean: false })}
                    className="mr-2"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Quantity-based</span>
                </label>
              </div>
            </div>

            {!formData.is_boolean && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Goal Value
                  </label>
                  <input
                    type="number"
                    value={formData.goal_value}
                    onChange={(e) => setFormData({ ...formData, goal_value: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., glasses, minutes"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              {editingHabit ? 'Update Habit' : 'Create Habit'}
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {habits.map(habit => (
          <div
            key={habit.id}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{habit.name}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{habit.frequency}</p>
              </div>
              <span className="text-2xl">
                {habit.is_boolean ? '✅' : '📊'}
              </span>
            </div>

            {!habit.is_boolean && (
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Goal: {habit.goal_value} {habit.unit}
              </p>
            )}

            <div className="flex space-x-2">
              <button
                onClick={() => startEdit(habit)}
                className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => {
                  if (confirm('Delete this habit?')) {
                    deleteHabit(habit.id);
                  }
                }}
                className="flex-1 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SleepView({ sleepLogs, logSleep, darkMode }) {
  const [formData, setFormData] = useState({
    bedtime: '',
    wakeTime: '',
    quality: 3
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await logSleep(formData);
    setFormData({ bedtime: '', wakeTime: '', quality: 3 });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sleep Tracker</h2>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Log Sleep</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Bedtime
              </label>
              <input
                type="time"
                value={formData.bedtime}
                onChange={(e) => setFormData({ ...formData, bedtime: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Wake Time
              </label>
              <input
                type="time"
                value={formData.wakeTime}
                onChange={(e) => setFormData({ ...formData, wakeTime: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sleep Quality (1-5 stars)
            </label>
            <div className="flex space-x-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFormData({ ...formData, quality: star })}
                  className="text-3xl transition-transform hover:scale-110"
                >
                  {star <= formData.quality ? '⭐' : '☆'}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Log Sleep
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Recent Sleep Logs</h3>

        {sleepLogs.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">No sleep logs yet</p>
        ) : (
          <div className="space-y-4">
            {sleepLogs.map(log => (
              <div
                key={log.id}
                className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-xl"
              >
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {new Date(log.log_date).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {log.bedtime} - {log.wake_time}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {log.total_hours}h
                  </p>
                  <div className="text-lg">
                    {'⭐'.repeat(log.quality)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TimetableView({ timetable, addTimetableEntry, deleteTimetableEntry, generateDailyPlan, aiPlan, aiPlanLoading, darkMode }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    course: '',
    day: 'Monday',
    start_time: '',
    end_time: ''
  });

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addTimetableEntry(formData);
    setFormData({ course: '', day: 'Monday', start_time: '', end_time: '' });
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Class Timetable</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          {showForm ? 'Cancel' : '+ Add Class'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Add Class</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Course Name
              </label>
              <input
                type="text"
                value={formData.course}
                onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Day
              </label>
              <select
                value={formData.day}
                onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {days.map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Time
                </label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  End Time
                </label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Add Class
            </button>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Weekly Schedule</h3>

        {timetable.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">No classes scheduled yet</p>
        ) : (
          <div className="space-y-4">
            {days.map(day => {
              const dayClasses = timetable.filter(e => e.day === day);
              if (dayClasses.length === 0) return null;

              return (
                <div key={day} className="border-l-4 border-blue-600 pl-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{day}</h4>
                  <div className="space-y-2">
                    {dayClasses.map(entry => (
                      <div
                        key={entry.id}
                        className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{entry.course}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {entry.start_time} - {entry.end_time}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            if (confirm('Remove this class?')) {
                              deleteTimetableEntry(entry.id);
                            }
                          }}
                          className="text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">AI Daily Planner</h3>
          <button
            onClick={generateDailyPlan}
            disabled={aiPlanLoading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {aiPlanLoading ? '⏳ Generating...' : '✨ Generate Plan'}
          </button>
        </div>

        {aiPlanLoading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              AI is currently deciding if you have time for a nap... Hang tight.
            </p>
          </div>
        )}

        {aiPlan && !aiPlanLoading && (
          <div className="prose dark:prose-invert max-w-none">
            <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              {aiPlan}
            </div>
          </div>
        )}

        {!aiPlan && !aiPlanLoading && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            Click "Generate Plan" to create your optimized daily schedule
          </p>
        )}
      </div>
    </div>
  );
}

function ProgressView({ habitLogs, habits, sleepLogs, darkMode }) {
  const getLast7DaysCompletion = () => {
    const last7Days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dailyHabits = habits.filter(h => h.frequency === 'Daily');
      if (dailyHabits.length === 0) {
        last7Days.push({ date: dateStr, percentage: 0 });
        continue;
      }

      const logsForDate = habitLogs.filter(l => l.log_date === dateStr);
      const completed = logsForDate.filter(log => {
        const habit = dailyHabits.find(h => h.id === log.habit_id);
        if (!habit) return false;
        return habit.is_boolean ? log.completed : log.value >= habit.goal_value;
      }).length;

      const percentage = Math.round((completed / dailyHabits.length) * 100);
      last7Days.push({ date: dateStr, percentage });
    }

    return last7Days;
  };

  const completionData = getLast7DaysCompletion();
  const maxPercentage = Math.max(...completionData.map(d => d.percentage), 100);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Progress Dashboard</h2>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Habit Completion Rate (Last 7 Days)
        </h3>

        <div className="space-y-4">
          {completionData.map((day, index) => (
            <div key={index} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {day.percentage}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                  style={{ width: `${day.percentage}%` }}
                >
                  {day.percentage > 0 && (
                    <span className="text-xs text-white font-medium">
                      {day.percentage}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Sleep Trend (Last 7 Days)
        </h3>

        {sleepLogs.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">No sleep data yet</p>
        ) : (
          <div className="space-y-4">
            {sleepLogs.slice(0, 7).reverse().map((log, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    {new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex items-center space-x-3">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {log.total_hours}h
                    </span>
                    <span>{'⭐'.repeat(log.quality)}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-blue-600 h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                    style={{ width: `${Math.min((parseFloat(log.total_hours) / 12) * 100, 100)}%` }}
                  >
                    <span className="text-xs text-white font-medium">
                      {log.total_hours}h
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
          <div className="text-4xl mb-2">🎯</div>
          <div className="text-3xl font-bold mb-1">
            {completionData[completionData.length - 1]?.percentage || 0}%
          </div>
          <div className="text-green-100">Today's Completion</div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <div className="text-4xl mb-2">📈</div>
          <div className="text-3xl font-bold mb-1">
            {Math.round(completionData.reduce((sum, d) => sum + d.percentage, 0) / completionData.length)}%
          </div>
          <div className="text-blue-100">7-Day Average</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="text-4xl mb-2">😴</div>
          <div className="text-3xl font-bold mb-1">
            {sleepLogs.length > 0
              ? (sleepLogs.reduce((sum, log) => sum + parseFloat(log.total_hours), 0) / sleepLogs.length).toFixed(1)
              : '0.0'
            }h
          </div>
          <div className="text-purple-100">Avg Sleep</div>
        </div>
      </div>
    </div>
  );
}

function ToastContainer({ toasts, darkMode }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`rounded-xl p-4 shadow-lg transform transition-all duration-300 ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : toast.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-blue-600 text-white'
          }`}
        >
          <div className="flex items-start space-x-3">
            {toast.icon && <span className="text-2xl">{toast.icon}</span>}
            <p className="flex-1 font-medium">{toast.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default App;
