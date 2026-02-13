/* public/app.js — COMPLETE, SELF-CONTAINED (drop-in replacement) */
(() => {
  /* ===============================
     SHORTCUTS & HELPERS
  =============================== */
  const qs = sel => document.querySelector(sel);
  const qsa = sel => Array.from(document.querySelectorAll(sel));
  const api = path => (path.startsWith("/") ? path : "/" + path);

  function safeText(v) { return v == null ? "" : v; }

  /* ===============================
     DOM REFERENCES (many can be absent — guard)
  =============================== */
  const authView = qs("#authView");
  const dashboardView = qs("#dashboardView");
  const trainerPanel = qs("#trainerPanel");

  const formSignIn = qs("#formSignIn");
  const formSignUp = qs("#formSignUp");
  const btnShowSignIn = qs("#showSignIn");
  const btnShowSignUp = qs("#showSignUp");

  const themeToggle = qs("#themeToggle");
  const userArea = qs("#userArea");

  const weekPicker = qs("#weekPicker");
  const btnPrevWeek = qs("#btnPrevWeek");
  const btnNextWeek = qs("#btnNextWeek");
  const btnReload = qs("#btnReload");

  const calendarEl = qs("#calendar");
  const calendarTitle = qs("#calendarTitle");

  const allocCourse = qs("#alloc_course");
  const allocModule = qs("#alloc_module");
  const allocTrainer = qs("#alloc_trainer");
  const slotModal = qs("#slotModal");
  const slotInfo = qs("#slotInfo");
  const allocSave = qs("#allocSave");
  const allocCancel = qs("#allocCancel");
  const allocFeedback = qs("#alloc_feedback");

  const quickModal = qs("#quickModal");
  const quickTitle = qs("#quickTitle");
  const quickBody = qs("#quickBody");
  const quickClose = qs("#quickClose");

  // multiple elements in HTML duplicate IDs — handle all
  const createBlankWeekButtons = qsa("#createBlankWeek");
  const newWeekInputs = qsa("#newWeek");

  const linkCourses = qs("#linkCourses");
  const linkModules = qs("#linkModules");
  const linkEnroll = qs("#linkEnroll");
  const linkTrainers = qs("#linkTrainers");

  const trainerScheduleWrap = qs("#trainerSchedule");
  const overviewEl = qs("#overview");

  /* ===============================
     STATE
  =============================== */
  let token = null;
  let currentUser = null;
  let isAdmin = false;
  let currentWeekStart = null;
  let selectedSlot = null;

  /* ===============================
     THEME
  =============================== */
  function applyTheme(theme) {
    if (theme === "light") document.documentElement.classList.add("light");
    else document.documentElement.classList.remove("light");
    try { localStorage.setItem("theme", theme); } catch(e){}
  }
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const mode = localStorage.getItem("theme") || "dark";
      applyTheme(mode === "dark" ? "light" : "dark");
    });
  }
  applyTheme(localStorage.getItem("theme") || "dark");

  /* ===============================
     AUTH HELPERS
  =============================== */
  function saveAuth(tok, user) {
    token = tok;
    currentUser = user;
    isAdmin = user?.role === "admin";
    try {
      sessionStorage.setItem("token", tok || "");
      sessionStorage.setItem("user", JSON.stringify(user || null));
    } catch (e) {}
    updateUserChip();
  }

  function loadAuth() {
    try {
      const t = sessionStorage.getItem("token");
      const u = sessionStorage.getItem("user");
      if (!t || !u) return false;
      token = t;
      currentUser = JSON.parse(u);
      isAdmin = currentUser?.role === "admin";
      updateUserChip();
      return true;
    } catch (e) { console.warn("loadAuth failed", e); return false; }
  }

  function clearAuth() {
    token = null;
    currentUser = null;
    isAdmin = false;
    try {
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");
    } catch (e) {}
    updateUserChip();
  }

  function updateUserChip() {
    if (!userArea) return;
    if (!currentUser) {
      userArea.innerHTML = `<span class="clickable muted" id="userLoginLink">Sign In</span>`;
      const loginLink = qs("#userLoginLink");
      if (loginLink) loginLink.addEventListener("click", showAuth);
      return;
    }
    userArea.innerHTML = `
      <div class="user-chip">
        ${safeText(currentUser.name)}
        <span class="muted">(${safeText(currentUser.role)})</span>
        <button id="btnLogout" class="btn small ghost">Logout</button>
      </div>
    `;
    const btnLogout = qs("#btnLogout");
    if (btnLogout) btnLogout.addEventListener("click", () => {
      if (!confirm("Logout?")) return;
      clearAuth();
      showAuth();
    });
  }

  /* ===============================
     UI: showAuth / showDashboard
  =============================== */
  function showAuth() {
    if (authView) authView.classList.remove("hidden");
    if (dashboardView) dashboardView.classList.add("hidden");
    if (trainerPanel) trainerPanel.classList.add("hidden");
  }

  function showDashboard() {
    if (authView) authView.classList.add("hidden");
    if (dashboardView) dashboardView.classList.remove("hidden");

    // trainer panel
    if (trainerPanel) {
      trainerPanel.classList.toggle("hidden", currentUser?.role !== "trainer");
    }

    // admin week creation block(s)
    const adminWeekTools = qs("#adminWeekTools");
    if (adminWeekTools) adminWeekTools.classList.toggle("hidden", !isAdmin);

    // admin control card (duplicate in HTML)
    const adminControls = qs("#adminControls");
    if (adminControls) adminControls.classList.toggle("hidden", !isAdmin);

    updateUserChip();

    // load current week (monday)
    const monday = getMonday(new Date());
    currentWeekStart = toISODate(monday);
    if (weekPicker) weekPicker.value = currentWeekStart;
    // set all newWeek inputs
    newWeekInputs.forEach(inp => { try{ inp.value = currentWeekStart }catch(e){} });

    renderDashboard();
  }

  /* ===============================
     AUTH FORM LOGIC
  =============================== */
  // Sign In
  if (formSignIn) {
    const errInEmail = qs("#err_in_email");
    const errInPass = qs("#err_in_password");
    const inFeedback = qs("#in_feedback");

    formSignIn.addEventListener("submit", async e => {
      e.preventDefault();
      if (errInEmail) errInEmail.textContent = "";
      if (errInPass) errInPass.textContent = "";
      if (inFeedback) inFeedback.textContent = "";

      const email = qs("#in_email")?.value?.trim() || "";
      const pass = qs("#in_password")?.value || "";

      if (!email) return (errInEmail && (errInEmail.textContent = "Enter email"));
      if (!pass) return (errInPass && (errInPass.textContent = "Enter password"));

      try {
        const res = await fetch(api("/api/auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: pass })
        });
        const out = await res.json();
        if (res.ok && out.token) {
          saveAuth(out.token, out.user);
          if (inFeedback) inFeedback.textContent = "Login successful...";
          setTimeout(showDashboard, 250);
        } else {
          if (inFeedback) inFeedback.textContent = out.message || "Invalid credentials";
        }
      } catch (err) {
        console.error("Sign in error", err);
        if (inFeedback) inFeedback.textContent = "Server error";
      }
    });
  }

  // Sign Up
  if (formSignUp) {
    const errUpName = qs("#err_up_name");
    const errUpEmail = qs("#err_up_email");
    const errUpPass = qs("#err_up_password");
    const upFeedback = qs("#up_feedback");

    const pwRules = {
      len: v => v.length >= 8,
      upper: v => /[A-Z]/.test(v),
      lower: v => /[a-z]/.test(v),
      digit: v => /[0-9]/.test(v),
      symbol: v => /[^A-Za-z0-9]/.test(v)
    };

    const pwInput = qs("#up_password");
    const pwMeter = qs("#meter");

    if (pwInput) {
      pwInput.addEventListener("input", () => {
        const v = pwInput.value || "";
        let ok = 0;
        qsa("#pw_rules li").forEach(li => {
          const rule = li.dataset.rule;
          if (pwRules[rule](v)) { li.classList.add("valid"); li.classList.remove("invalid"); ok++; }
          else { li.classList.add("invalid"); li.classList.remove("valid"); }
        });
        if (pwMeter) pwMeter.style.width = (ok / 5) * 100 + "%";
      });
    }

    formSignUp.addEventListener("submit", async e => {
      e.preventDefault();
      if (errUpName) errUpName.textContent = "";
      if (errUpEmail) errUpEmail.textContent = "";
      if (errUpPass) errUpPass.textContent = "";
      if (upFeedback) upFeedback.textContent = "";

      const name = qs("#up_name")?.value?.trim() || "";
      const email = qs("#up_email")?.value?.trim() || "";
      const password = qs("#up_password")?.value || "";
      const role = qs("#up_role")?.value || "student";

      if (!name) return (errUpName && (errUpName.textContent = "Enter name"));
      if (!email) return (errUpEmail && (errUpEmail.textContent = "Enter email"));

      const fails = Object.keys(pwRules).filter(r => !pwRules[r](password));
      if (fails.length) return (errUpPass && (errUpPass.textContent = "Weak password"));

      try {
        const res = await fetch(api("/api/auth/register"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password, role })
        });
        const out = await res.json();
        if (!res.ok) return (upFeedback && (upFeedback.textContent = out.message || "Registration failed"));

        upFeedback && (upFeedback.textContent = "Account created — logging in...");
        // auto login
        const log = await fetch(api("/api/auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        const logOut = await log.json();
        if (log.ok && logOut.token) {
          saveAuth(logOut.token, logOut.user);
          setTimeout(showDashboard, 250);
        } else {
          upFeedback && (upFeedback.textContent = "Please sign in");
        }
      } catch (err) {
        console.error("Sign up error", err);
        upFeedback && (upFeedback.textContent = "Server error");
      }
    });
  }

  // tab toggle for auth
  if (btnShowSignIn && btnShowSignUp && formSignIn && formSignUp) {
    btnShowSignIn.addEventListener("click", () => {
      btnShowSignIn.classList.add("active");
      btnShowSignUp.classList.remove("active");
      formSignIn.classList.remove("hidden");
      formSignUp.classList.add("hidden");
    });
    btnShowSignUp.addEventListener("click", () => {
      btnShowSignUp.classList.add("active");
      btnShowSignIn.classList.remove("active");
      formSignUp.classList.remove("hidden");
      formSignIn.classList.add("hidden");
    });
  }

  /* ===============================
     PASSWORD SHOW/HIDE (works for all .pwToggle)
  =============================== */
  qsa(".pwToggle").forEach(btn => {
    try {
      btn.addEventListener("click", () => {
        const target = document.getElementById(btn.dataset.target);
        if (!target) return;
        if (target.type === "password") { target.type = "text"; btn.textContent = "Hide"; }
        else { target.type = "password"; btn.textContent = "Show"; }
      });
    } catch (e) { console.warn("pwToggle bind failed", e); }
  });

  /* ===============================
     QUICK MODAL UTIL
  =============================== */
  if (quickClose) quickClose.addEventListener("click", () => quickModal && quickModal.classList.add("hidden"));
  function openQuickModal(title, itemsHtmlOrArray) {
    if (!quickModal || !quickTitle || !quickBody) return;
    quickTitle.textContent = title;
    quickBody.innerHTML = "";
    if (!itemsHtmlOrArray || (Array.isArray(itemsHtmlOrArray) && itemsHtmlOrArray.length === 0)) {
      quickBody.innerHTML = `<div class="muted">No data</div>`;
    } else if (typeof itemsHtmlOrArray === "string") {
      quickBody.innerHTML = itemsHtmlOrArray;
    } else {
      // array
      itemsHtmlOrArray.forEach(x => {
        const div = document.createElement("div");
        div.className = "list-item";
        if (typeof x === "string") div.textContent = x;
        else if (x instanceof HTMLElement) div.appendChild(x);
        else div.textContent = JSON.stringify(x);
        quickBody.appendChild(div);
      });
    }
    quickModal.classList.remove("hidden");
  }

  /* ===============================
     ENROLL FUNCTION (student & admin)
  =============================== */
  async function enrollStudent(studentId, courseId) {
    if (!studentId || !courseId) return alert("Missing student or course");
    if (!confirm(`Enroll student ${studentId} in course ${courseId}?`)) return;
    try {
      const res = await fetch(`/api/enrollments/student/${studentId}/course/${courseId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": "Bearer " + token } : {})
        }
      });
      const out = await res.json();
      if (!res.ok) return alert(out.message || "Enroll failed");
      alert(out.message || "Enrolled successfully");
      if (currentUser && currentUser.id === studentId) {
        loadScheduleForWeek(currentWeekStart);
      }
    } catch (err) {
      console.error("Enroll error", err);
      alert("Server error");
    }
  }
  window.enrollStudent = enrollStudent;

  /* ===============================
     QUICK LINKS: COURSES (with enroll buttons)
  =============================== */
  if (linkCourses) {
    linkCourses.addEventListener("click", async () => {
      try {
        const res = await fetch("/api/courses", { headers: token ? { "Authorization": "Bearer " + token } : {} });
        const rows = await res.json();
        quickTitle.textContent = "Courses";
        quickBody.innerHTML = "";
        if (!Array.isArray(rows)) {
          quickBody.innerHTML = `<div class="muted">No courses</div>`;
          quickModal.classList.remove("hidden");
          return;
        }
        rows.forEach(c => {
          const div = document.createElement("div");
          div.className = "list-item";
          const span = document.createElement("span");
          span.textContent = `${c.id} — ${c.title}`;
          div.appendChild(span);

          if (currentUser?.role === "admin") {
            const btn = document.createElement("button");
            btn.className = "btn small";
            btn.textContent = "Enroll student";
            btn.addEventListener("click", () => {
              const sid = prompt("Enter student ID to enroll:");
              if (!sid) return;
              enrollStudent(parseInt(sid, 10), c.id);
            });
            div.appendChild(btn);
          } else if (currentUser?.role === "student") {
            const btn = document.createElement("button");
            btn.className = "btn small";
            btn.textContent = "Enroll me";
            btn.addEventListener("click", () => enrollStudent(currentUser.id, c.id));
            div.appendChild(btn);
          }

          quickBody.appendChild(div);
        });
        quickModal.classList.remove("hidden");
      } catch (err) {
        console.error("linkCourses error", err);
        openQuickModal("Courses", ["Failed to load courses"]);
      }
    });
  }

  /* ===============================
     QUICK LINKS: MODULES / TRAINERS / ENROLLMENTS
  =============================== */
  if (linkModules) {
    linkModules.addEventListener("click", async () => {
      try {
        const res = await fetch("/api/courses");
        const courses = await res.json();
        const items = [];
        for (const c of courses) {
          items.push(`--- ${c.title} ---`);
          try {
            const modRes = await fetch(`/api/courses/${c.id}/modules`);
            const mods = await modRes.json();
            if (!Array.isArray(mods) || mods.length === 0) items.push("   (no modules)");
            else mods.forEach(m => items.push(`   ${m.id} — ${m.title}`));
          } catch (e) {
            items.push("   (failed to load modules)");
          }
        }
        openQuickModal("Modules", items);
      } catch (err) {
        console.error("linkModules error", err);
        openQuickModal("Modules", ["Failed to load"]);
      }
    });
  }

  if (linkTrainers) {
    linkTrainers.addEventListener("click", async () => {
      try {
        const res = await fetch("/api/users/trainers", { headers: token ? { "Authorization": "Bearer " + token } : {} });
        const trainers = await res.json();
        if (!Array.isArray(trainers)) return openQuickModal("Trainers", ["No trainers"]);
        const items = trainers.map(t => `${t.id} — ${t.display || t.name}`);
        openQuickModal("Trainers", items);
      } catch (err) {
        console.error("linkTrainers error", err);
        openQuickModal("Trainers", ["Failed to load"]);
      }
    });
  }

  if (linkEnroll) {
    linkEnroll.addEventListener("click", async () => {
      try {
        if (isAdmin) {
          const sRes = await fetch("/api/users/students", { headers: { "Authorization": "Bearer " + token } });
          const students = await sRes.json();
          const items = [];
          for (const stu of students) {
            items.push(`${stu.id} — ${stu.name}`);
            try {
              const er = await fetch(`/api/enrollments/student/${stu.id}/courses`, { headers: { "Authorization": "Bearer " + token }});
              const list = await er.json();
              if (!Array.isArray(list) || list.length === 0) items.push("   (no enrollments)");
              else list.forEach(v => items.push(`   ${v.course_id} — ${v.title}`));
            } catch (e) {
              items.push("   (failed to load enrollments)");
            }
          }
          openQuickModal("Student Enrollments", items);
        } else {
          if (!currentUser) return openQuickModal("Enrollments", ["Login first"]);
          const r = await fetch(`/api/enrollments/student/${currentUser.id}/courses`, { headers: { "Authorization": "Bearer " + token }});
          const list = await r.json();
          if (!Array.isArray(list) || list.length === 0) openQuickModal("Your Enrollments", ["No enrollments"]);
          else openQuickModal("Your Enrollments", list.map(c => `${c.course_id} — ${c.title}`));
        }
      } catch (err) {
        console.error("linkEnroll error", err);
        openQuickModal("Enrollments", ["Failed to load"]);
      }
    });
  }

  /* ===============================
     ALLOCATE MODAL DROPDOWNS (admin)
  =============================== */
  async function populateAllocDropdowns(slot) {
    // COURSES
    if (!allocCourse) return;
    try {
      const res = await fetch("/api/courses");
      const courses = await res.json();
      allocCourse.innerHTML = `<option value="">(none)</option>` + (Array.isArray(courses) ? courses.map(c => `<option value="${c.id}">${c.id} — ${escapeHtml(c.title)}</option>`).join("") : "");
      if (slot && slot.course_id) allocCourse.value = slot.course_id;
    } catch (e) { allocCourse.innerHTML = `<option>(failed)</option>`; }

    // TRAINERS
    if (allocTrainer) {
      try {
        const r = await fetch("/api/users/trainers", { headers: { "Authorization": "Bearer " + token }});
        const tlist = await r.json();
        allocTrainer.innerHTML = `<option value="">(none)</option>` + (Array.isArray(tlist) ? tlist.map(t => `<option value="${t.id}">${t.id} — ${escapeHtml(t.display || t.name)}</option>`).join("") : "");
        if (slot && slot.trainer_id) allocTrainer.value = slot.trainer_id;
      } catch (e) { allocTrainer.innerHTML = `<option>(failed)</option>`; }
    }

    // modules on change
    if (allocCourse && allocModule) {
      allocCourse.removeEventListener("change", allocCourse._changeHandler || (()=>{}));
      const changeHandler = async () => {
        const cid = allocCourse.value;
        if (!cid) { allocModule.innerHTML = `<option value="">(none)</option>`; return; }
        try {
          const r = await fetch(`/api/courses/${cid}/modules`);
          const mods = await r.json();
          allocModule.innerHTML = `<option value="">(none)</option>` + (Array.isArray(mods) ? mods.map(m => `<option value="${m.id}">${m.id} — ${escapeHtml(m.title)}</option>`).join("") : "");
        } catch (e) { allocModule.innerHTML = `<option>(failed)</option>`; }
      };
      allocCourse.addEventListener("change", changeHandler);
      allocCourse._changeHandler = changeHandler;

      // load module if prefilled
      if (slot?.course_id) {
        allocCourse.dispatchEvent(new Event("change"));
        setTimeout(() => { if (slot.module_id) allocModule.value = slot.module_id; }, 200);
      } else {
        allocModule.innerHTML = `<option value="">(none)</option>`;
      }
    }
  }

  function escapeHtml(s) {
    return (s + "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  }

  /* ===============================
     OPEN / SAVE ALLOCATE MODAL
  =============================== */
  function openAllocateModal(slot) {
    if (!isAdmin) return alert("Only admins can allocate");
    if (!slotModal) return;
    selectedSlot = slot;
    if (slotInfo) slotInfo.textContent = `Week ${slot.week_start} • ${slot.day} • ${slot.slot} • Slot ID ${slot.id}`;
    if (allocFeedback) allocFeedback.textContent = "";
    slotModal.classList.remove("hidden");
    populateAllocDropdowns(slot);
  }
  if (allocCancel) allocCancel.addEventListener("click", () => {
    selectedSlot = null;
    if (slotModal) slotModal.classList.add("hidden");
    if (allocFeedback) allocFeedback.textContent = "";
  });
  if (allocSave) allocSave.addEventListener("click", async () => {
    if (!selectedSlot) return;
    if (allocFeedback) allocFeedback.textContent = "Saving...";
    const payload = {
      course_id: allocCourse?.value || null,
      module_id: allocModule?.value || null,
      trainer_id: allocTrainer?.value || null
    };
    try {
      const res = await fetch(`/api/schedule/slot/${selectedSlot.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify(payload)
      });
      const out = await res.json();
      if (!res.ok) {
        if (allocFeedback) allocFeedback.textContent = out.message || "Save failed";
        return;
      }
      if (allocFeedback) allocFeedback.textContent = "Saved!";
      setTimeout(() => { slotModal.classList.add("hidden"); loadScheduleForWeek(currentWeekStart); }, 300);
    } catch (err) {
      console.error("alloc save error", err);
      if (allocFeedback) allocFeedback.textContent = "Server error";
    }
  });

  /* ===============================
     DATE HELPERS
  =============================== */
  function toISODate(d) {
    const z = n => (n < 10 ? "0" + n : n);
    return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
  }
  function getMonday(d0) {
    const d = new Date(d0);
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0,0,0,0);
    return d;
  }
  function addDaysIso(iso, days) {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + days);
    return toISODate(d);
  }

  /* ===============================
     WEEK PICKER BUTTONS
  =============================== */
  if (weekPicker) weekPicker.addEventListener("change", () => {
    const val = weekPicker.value;
    if (!val) return;
    currentWeekStart = toISODate(getMonday(new Date(val)));
    loadScheduleForWeek(currentWeekStart);
  });
  if (btnPrevWeek) btnPrevWeek.addEventListener("click", () => {
    currentWeekStart = addDaysIso(currentWeekStart, -7);
    if (weekPicker) weekPicker.value = currentWeekStart;
    loadScheduleForWeek(currentWeekStart);
  });
  if (btnNextWeek) btnNextWeek.addEventListener("click", () => {
    currentWeekStart = addDaysIso(currentWeekStart, 7);
    if (weekPicker) weekPicker.value = currentWeekStart;
    loadScheduleForWeek(currentWeekStart);
  });
  if (btnReload) btnReload.addEventListener("click", () => loadScheduleForWeek(currentWeekStart));

  // create blank week: attach to all buttons (duplicate in HTML)
  createBlankWeekButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
      // pick the first newWeek input value if any
      const date = (newWeekInputs.find(i => !!i?.value)?.value) || (weekPicker?.value) || currentWeekStart;
      if (!date) return alert("Pick a date");
      try {
        const res = await fetch("/api/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
          body: JSON.stringify({ week_start: date })
        });
        const out = await res.json();
        alert(out.message || "Week created");
        loadScheduleForWeek(date);
      } catch (err) {
        console.error("create week error", err);
        alert("Week creation failed");
      }
    });
  });

  /* ===============================
     DAY INDEX MAP
  =============================== */
  function dayIndex(day) {
    return { Mon:0, Tue:1, Wed:2, Thu:3, Fri:4, Sat:5, Sun:6 }[day];
  }

  /* ===============================
     RENDER: ADMIN / TRAINER / STUDENT
  =============================== */

  function renderCalendarAdmin(daysObj = {}, weekStart) {
    if (!calendarEl) return;
    const orderedDays = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    calendarEl.innerHTML = "";
    orderedDays.forEach(day => {
      const slots = daysObj[day] || [];
      const col = document.createElement("div"); col.className = "day";
      col.innerHTML = `<h5>${day}</h5>`;
      if (!slots.length) col.innerHTML += `<div class="muted small">No slots</div>`;
      slots.forEach(slot => {
        const s = document.createElement("div");
        s.className = "slot small";
        s.draggable = true;
        const text = `${slot.slot} — ${slot.course_title || "Unassigned"}${slot.module_title ? " / "+slot.module_title : ""}${slot.trainer_name ? " / "+slot.trainer_name : ""}`;
        s.textContent = text;
        s.addEventListener("click", () => openAllocateModal(slot));
        s.addEventListener("dragstart", ev => { s.classList.add("dragging"); ev.dataTransfer.setData("text/plain", JSON.stringify(slot)); });
        s.addEventListener("dragend", () => s.classList.remove("dragging"));
        col.appendChild(s);
      });
      // drop target behaviour uses daysObj structure
      col.addEventListener("dragover", ev => { ev.preventDefault(); col.classList.add("drop-target"); });
      col.addEventListener("dragleave", () => col.classList.remove("drop-target"));
      col.addEventListener("drop", async ev => {
        ev.preventDefault(); col.classList.remove("drop-target");
        try {
          const data = JSON.parse(ev.dataTransfer.getData("text/plain"));
          const targetDaySlots = daysObj[day] || [];
          const emptySlot = targetDaySlots.find(s => !s.course_id);
          if (!emptySlot) { alert("No empty slot available in this day!"); return; }
          // move assignment
          await fetch(`/api/schedule/slot/${emptySlot.id}`, {
            method: "PUT",
            headers: { "Content-Type":"application/json", "Authorization":"Bearer "+token },
            body: JSON.stringify({ course_id: data.course_id, module_id: data.module_id, trainer_id: data.trainer_id })
          });
          // clear old slot
          await fetch(`/api/schedule/slot/${data.id}`, {
            method: "PUT",
            headers: { "Content-Type":"application/json", "Authorization":"Bearer "+token },
            body: JSON.stringify({ course_id: null, module_id: null, trainer_id: null })
          });
          loadScheduleForWeek(currentWeekStart);
        } catch (err) { console.error("drop error", err); alert("Error while moving slot"); }
      });
      calendarEl.appendChild(col);
    });
  }

  function renderStudentCalendar(slots = [], weekStart) {
    if (!calendarEl) return;
    calendarEl.innerHTML = "";
    const monday = new Date(weekStart + "T00:00:00");
    const days = [];
    for (let i=0;i<7;i++) {
      const d = new Date(monday); d.setDate(d.getDate()+i);
      days.push({ label: d.toLocaleDateString("en-US",{ weekday:"long", month:"short", day:"numeric" }), isToday: new Date().toDateString() === d.toDateString(), slots: [] });
    }
    slots.forEach(s => {
      const idx = dayIndex(s.day);
      if (idx !== undefined) days[idx].slots.push(s);
    });
    days.forEach(d => {
      const col = document.createElement("div"); col.className = "day";
      if (d.isToday) col.classList.add("today-highlight");
      col.innerHTML = `<h5>${d.label}</h5>`;
      if (!d.slots.length) col.innerHTML += `<p class="muted">No classes</p>`;
      else {
        d.slots.sort((a,b)=> String(a.slot).localeCompare(b.slot));
        d.slots.forEach(s => {
          const div = document.createElement("div"); div.className = "slot";
          div.innerHTML = `<strong>${s.slot}</strong><br><span>${safeText(s.course_title)}</span><br><small>${safeText(s.module_title)}</small><br><small class="muted">Trainer: ${safeText(s.trainer_name||"—")}</small>`;
          col.appendChild(div);
        });
      }
      calendarEl.appendChild(col);
    });
  }

  function renderTrainerCalendar(slots = [], weekStart) {
    if (!trainerScheduleWrap) return;
    trainerPanel && trainerPanel.classList.remove("hidden");
    trainerScheduleWrap.innerHTML = "";
    const monday = new Date(weekStart + "T00:00:00");
    const days = [];
    for (let i=0;i<7;i++) {
      const d = new Date(monday); d.setDate(d.getDate()+i);
      days.push({ label: d.toLocaleDateString("en-US",{ weekday:"long", month:"short", day:"numeric" }), slots: [] });
    }
    slots.forEach(s => {
      const idx = dayIndex(s.day);
      if (idx !== undefined) days[idx].slots.push(s);
    });
    days.forEach(d => {
      const card = document.createElement("div"); card.className = "trainer-day-card";
      card.innerHTML = `<h4>${d.label}</h4>`;
      if (!d.slots.length) card.innerHTML += `<p class="muted">No sessions</p>`;
      else {
        const list = document.createElement("div"); list.className = "trainer-slot-list";
        d.slots.sort((a,b)=> String(a.slot).localeCompare(b.slot));
        d.slots.forEach(s => {
          const row = document.createElement("div"); row.className = "trainer-slot";
          row.innerHTML = `<div class="time">${s.slot}</div><div class="content"><div class="course">${s.course_title || "—"}</div><div class="module">${s.module_title || ""}</div></div>`;
          list.appendChild(row);
        });
        card.appendChild(list);
      }
      trainerScheduleWrap.appendChild(card);
    });
  }

  /* ===============================
     LOAD SCHEDULE FOR WEEK — robust parsing
  =============================== */
  async function loadScheduleForWeek(weekStart) {
    if (!calendarTitle || !calendarEl) return;
    calendarTitle.textContent = `Week of ${weekStart}`;
    calendarEl.innerHTML = "Loading...";

    try {
      // ADMIN
      if (isAdmin) {
        const res = await fetch(`/api/schedule/${weekStart}`, { headers: { "Authorization":"Bearer "+token }});
        const data = await res.json();
        if (data?.message === "NO_WEEK") { calendarEl.innerHTML = `<div class="muted">Week not created yet</div>`; return; }
        // expect data.days
        renderCalendarAdmin(data.days || {}, weekStart);
        return;
      }

      // TRAINER
      if (currentUser?.role === "trainer") {
        const url = `/api/schedule/trainer/${currentUser.id}?week_start=${weekStart}`;
        console.log("Fetching trainer schedule:", url);
        const res = await fetch(url, { headers: token ? { "Authorization":"Bearer "+token } : {} });
        const data = await res.json();
        console.log("Trainer API response:", data);
        let arr = [];
        if (Array.isArray(data)) arr = data;
        else if (data?.days && typeof data.days === "object") {
          ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(d => { if (Array.isArray(data.days[d])) arr.push(...data.days[d]); });
        } else if (Array.isArray(data?.timetable)) arr = data.timetable;
        else if (Array.isArray(data?.slots)) arr = data.slots;
        renderTrainerCalendar(arr, weekStart);
        return;
      }

      // STUDENT
      // If not logged in, show guest view with message
      if (!currentUser) {
        calendarEl.innerHTML = `<div class="muted">Login to see your timetable</div>`;
        return;
      }

      if (currentUser?.role === "student") {
        const url = `/api/timetable/student/${currentUser.id}?week_start=${weekStart}`;
        console.log("Fetching student timetable:", url);
        const res = await fetch(url, { headers: token ? { "Authorization":"Bearer "+token } : {} });
        const data = await res.json();
        console.log("Student API response:", data);
        let slots = [];
        if (Array.isArray(data)) slots = data;
        if (Array.isArray(data?.timetable)) slots = data.timetable;
        if (data?.days && typeof data.days === "object") {
          ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(d => { if (Array.isArray(data.days[d])) slots.push(...data.days[d]); });
        }
        // Some backends return { timetable: [], days: {} } or { slots: [] } or array
        if (Array.isArray(data?.slots) && !slots.length) slots = data.slots;
        renderStudentCalendar(slots, weekStart);
        return;
      }

      // fallback: unknown role
      calendarEl.innerHTML = `<div class="muted">Unable to determine view</div>`;
    } catch (err) {
      console.error("loadScheduleForWeek error:", err);
      calendarEl.innerHTML = `<div class="muted">Failed to load schedule</div>`;
    }
  }
  window.loadScheduleForWeek = loadScheduleForWeek;

  /* ===============================
     RENDER DASHBOARD (overview & load)
  =============================== */
  function renderDashboard() {
    const title = qs("#dashTitle");
    const sub = qs("#dashSubtitle");
    const ov = qs("#overview");
    if (title) {
      if (isAdmin) { title.textContent = "Admin Dashboard"; sub && (sub.textContent = "Manage schedule allocations & weeks"); }
      else if (currentUser?.role === "trainer") { title.textContent = "Trainer Dashboard"; sub && (sub.textContent = "Your allocated weekly sessions"); }
      else { title.textContent = "Student Dashboard"; sub && (sub.textContent = "Your weekly timetable"); }
    }
    if (ov) ov.textContent = currentUser ? `${currentUser.name} (${currentUser.role})` : "Guest";
    loadScheduleForWeek(currentWeekStart);
  }

  /* ===============================
     INIT UI
  =============================== */
  function initUI() {
    // attach click to user area to open auth if not logged
    if (userArea) userArea.addEventListener("click", () => { if (!currentUser) showAuth(); });

    // Quick guest continue button (if present)
    const btnGuest = qs("#btnGuest");
    if (btnGuest) btnGuest.addEventListener("click", () => {
      clearAuth();
      // show dashboard as guest (will show message)
      showDashboard();
    });

    // Try to load saved auth; if present show dashboard else auth view
    const had = loadAuth();
    if (had) showDashboard();
    else showAuth();

    // set default week values on all inputs
    const monday = getMonday(new Date());
    currentWeekStart = toISODate(monday);
    if (weekPicker) weekPicker.value = currentWeekStart;
    newWeekInputs.forEach(inp => { try { inp.value = currentWeekStart } catch (e) {} });
  }

  initUI();

  /* ===============================
     Utility: basic escape for innerHTML when needed
  =============================== */
  function escapeHtml(s) {
    return (s + "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  }

  // Expose small helpers for debugging in console
  window._schedpro = { loadScheduleForWeek, enrollStudent, saveAuth, clearAuth, getCurrentUser: () => currentUser };

})(); 
