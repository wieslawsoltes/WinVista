import { basename, downloadBlob } from "../core/index.js";
import {
  h,
  icon,
  button,
  tool,
  field,
  menuBar,
  statusBar,
  chooseFiles,
} from "../ui/index.js";

export function launch(d, id, args = {}) {
  if (id === "calendar") return calendar(d);
  if (id === "contacts") return contacts(d, args);
  if (id === "mail") return mail(d, args);
}
const localDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const icsEscape = (text) =>
  String(text || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
const icsTime = (date) =>
  new Date(date)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
const parseICSTime = (value) =>
  /^\d{8}$/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00`
    : value.replace(
        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/,
        "$1-$2-$3T$4:$5:$6$7",
      );
export function exportCalendar(events) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vista Desktop//Windows Calendar//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      "UID:" + icsEscape(e.id),
      "DTSTAMP:" + icsTime(Date.now()),
      "DTSTART:" + icsTime(e.start),
      "DTEND:" + icsTime(e.end),
      "SUMMARY:" + icsEscape(e.title),
      "DESCRIPTION:" + icsEscape(e.notes || ""),
      "LOCATION:" + icsEscape(e.location || ""),
    );
    if (e.repeat && e.repeat !== "NONE") lines.push("RRULE:FREQ=" + e.repeat);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
export function importCalendar(text) {
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/),
    events = [];
  let e = null;
  const unescape = (v) => v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      e = {
        id: crypto.randomUUID(),
        title: "Untitled",
        notes: "",
        location: "",
        repeat: "NONE",
      };
      continue;
    }
    if (line === "END:VEVENT") {
      if (e?.start && Number.isFinite(new Date(e.start).valueOf())) {
        const start = new Date(e.start).getTime(),
          end = e.end ? new Date(e.end).getTime() : start + 3600000;
        if (!Number.isFinite(end) || end < start)
          throw new Error("The calendar contains an invalid event end date.");
        e.end = new Date(end).toISOString();
        events.push(e);
      }
      e = null;
      continue;
    }
    if (!e) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).split(";")[0],
      value = line.slice(colon + 1);
    if (key === "UID") e.id = value;
    if (key === "SUMMARY") e.title = unescape(value);
    if (key === "DESCRIPTION") e.notes = unescape(value);
    if (key === "LOCATION") e.location = unescape(value);
    if (
      (key === "DTSTART" || key === "DTEND") &&
      /;TZID=/i.test(line.slice(0, colon))
    )
      throw new Error(
        "This calendar uses named time zones. Export it with UTC times before importing.",
      );
    if (key === "DTSTART") e.start = parseICSTime(value);
    if (key === "DTEND") e.end = parseICSTime(value);
    if (key === "RRULE") {
      if (!/^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)$/.test(value))
        throw new Error(
          "This calendar uses a recurrence rule that is not supported. Import individual events or a simple daily, weekly, monthly, or yearly recurrence.",
        );
      e.repeat = value.slice(5);
    }
  }
  return events;
}

function calendar(d) {
  const win = d.wm.create({
      title: "Windows Calendar",
      icon: "calendar",
      appId: "calendar",
      width: 890,
      height: 635,
      remember: true,
    }),
    side = h("div", { class: "calendar-side" }),
    main = h("div", { class: "calendar-main" }),
    heading = h("div", { class: "calendar-heading" }),
    grid = h("div", { class: "calendar-grid" }),
    status = statusBar("");
  let displayed = new Date(),
    events = d.settings.get("calendarEvents", []),
    tasks = d.settings.get("calendarTasks", []),
    showEvents = true;
  const persist = () => {
    d.settings.set("calendarEvents", events);
    d.settings.set("calendarTasks", tasks);
    render();
  };
  async function appointment(date = new Date(), existing = null) {
    const event = existing || {
        id: crypto.randomUUID(),
        title: "",
        start: new Date(`${localDate(date)}T09:00:00`).toISOString(),
        end: new Date(`${localDate(date)}T10:00:00`).toISOString(),
        notes: "",
        location: "",
        repeat: "NONE",
      },
      start = new Date(event.start),
      title = h("input", {
        class: "vista-input",
        value: event.title,
        "aria-label": "Appointment title",
      }),
      day = h("input", {
        class: "vista-input",
        type: "date",
        value: localDate(start),
      }),
      time = h("input", {
        class: "vista-input",
        type: "time",
        value: start.toTimeString().slice(0, 5),
      }),
      duration = h("input", {
        class: "vista-input",
        type: "number",
        min: 5,
        max: 10080,
        step: 5,
        value: Math.max(5, (new Date(event.end) - start) / 60000),
      }),
      location = h("input", {
        class: "vista-input",
        value: event.location || "",
      }),
      notes = h("textarea", {
        class: "vista-input",
        value: event.notes || "",
        rows: 4,
        style: { width: "100%", resize: "vertical" },
      }),
      repeat = h(
        "select",
        { class: "vista-input" },
        [
          ["NONE", "Does not repeat"],
          ["DAILY", "Every day"],
          ["WEEKLY", "Every week"],
          ["MONTHLY", "Every month"],
          ["YEARLY", "Every year"],
        ].map(([v, label]) =>
          h("option", { value: v, selected: event.repeat === v }, label),
        ),
      );
    const result = await d.dialog.form({
      title: existing ? "Edit Appointment" : "New Appointment",
      width: 490,
      body: h(
        "div",
        {},
        field("Subject:", title),
        field("Date:", day),
        field("Start time:", time),
        field("Minutes:", duration),
        field("Location:", location),
        field("Repeat:", repeat),
        field("Notes:", notes),
      ),
      focus: title,
      buttons: [
        { label: "Save", value: "save", primary: true },
        ...(existing ? [{ label: "Delete", value: "delete" }] : []),
        { label: "Cancel", value: null },
      ],
    });
    if (result === "delete") {
      events = events.filter((e) => e.id !== event.id);
      persist();
    }
    if (result === "save") {
      if (!title.value.trim()) {
        d.dialog.message("Calendar", "An appointment needs a subject.");
        return;
      }
      const startDate = new Date(`${day.value}T${time.value || "09:00"}:00`);
      if (!Number.isFinite(startDate.valueOf())) {
        d.dialog.message("Calendar", "Choose a valid date and time.");
        return;
      }
      const updated = {
        ...event,
        title: title.value.trim(),
        start: startDate.toISOString(),
        end: new Date(
          startDate.getTime() +
            Math.max(5, Math.min(10080, Number(duration.value) || 60)) * 60000,
        ).toISOString(),
        location: location.value,
        notes: notes.value,
        repeat: repeat.value,
      };
      events = events.filter((e) => e.id !== event.id);
      events.push(updated);
      persist();
    }
  }
  const newTask = async () => {
    const text = await d.dialog.prompt("New Task", "Task:", "");
    if (text) {
      tasks.push({ id: crypto.randomUUID(), title: text, done: false });
      persist();
    }
  };
  function occurs(e, date) {
    const start = new Date(e.start),
      end = new Date(e.end),
      day = localDate(date),
      startDay = localDate(start);
    if (day === startDay) return true;
    if (date < new Date(start.getFullYear(), start.getMonth(), start.getDate()))
      return false;
    if (e.repeat === "DAILY") return true;
    if (e.repeat === "WEEKLY") return date.getDay() === start.getDay();
    if (e.repeat === "MONTHLY") return date.getDate() === start.getDate();
    if (e.repeat === "YEARLY")
      return (
        date.getDate() === start.getDate() &&
        date.getMonth() === start.getMonth()
      );
    return date > start && date < end;
  }
  function render() {
    heading.replaceChildren(
      button(
        "‹",
        () => {
          displayed = new Date(
            displayed.getFullYear(),
            displayed.getMonth() - 1,
            1,
          );
          render();
        },
        "vista-button",
        { "aria-label": "Previous month" },
      ),
      h(
        "span",
        {},
        displayed.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
      ),
      button(
        "›",
        () => {
          displayed = new Date(
            displayed.getFullYear(),
            displayed.getMonth() + 1,
            1,
          );
          render();
        },
        "vista-button",
        { "aria-label": "Next month" },
      ),
      h("span", { class: "spacer" }),
      button(
        "Today",
        () => {
          displayed = new Date();
          render();
        },
        "vista-button",
      ),
    );
    grid.replaceChildren();
    for (const day of [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ])
      grid.append(
        h(
          "div",
          { class: "calendar-weekday" },
          innerWidth < 650 ? day.slice(0, 3) : day,
        ),
      );
    const first = new Date(displayed.getFullYear(), displayed.getMonth(), 1),
      start = new Date(first);
    start.setDate(1 - first.getDay());
    for (let i = 0; i < 42; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const day = h(
        "div",
        {
          class:
            "calendar-day" +
            (date.getMonth() !== displayed.getMonth() ? " other" : "") +
            (localDate(date) === localDate(new Date()) ? " today" : ""),
          tabIndex: 0,
          "aria-label": date.toLocaleDateString(),
        },
        h("span", { class: "date-number" }, date.getDate()),
      );
      day.ondblclick = () => appointment(date);
      day.onkeydown = (e) => {
        if (e.key === "Enter") appointment(date);
      };
      for (const event of events
        .filter((e) => showEvents && occurs(e, date))
        .sort((a, b) => new Date(a.start) - new Date(b.start))) {
        day.append(
          button(
            new Date(event.start).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            }) +
              " " +
              event.title,
            (e) => {
              e.stopPropagation();
              appointment(date, event);
            },
            "calendar-event",
            {
              title:
                event.title + (event.location ? "\n" + event.location : ""),
            },
          ),
        );
      }
      grid.append(day);
    }
    side.replaceChildren(
      h("h3", { style: { color: "#30639b" } }, "Calendars"),
      h(
        "label",
        { class: "field" },
        h("input", {
          type: "checkbox",
          checked: showEvents,
          onchange: (e) => {
            showEvents = e.target.checked;
            render();
          },
        }),
        "My Calendar",
      ),
      h("p", { class: "muted" }, "Double-click a day to add an appointment."),
      h(
        "div",
        { class: "calendar-tasks" },
        h("h3", {}, "Tasks"),
        ...tasks.map((task) =>
          h(
            "label",
            {},
            h("input", {
              type: "checkbox",
              checked: task.done,
              onchange: (e) => {
                task.done = e.target.checked;
                persist();
              },
            }),
            h(
              "span",
              {
                style: { textDecoration: task.done ? "line-through" : "none" },
              },
              task.title,
            ),
          ),
        ),
        button("New Task", newTask, "link-button"),
        button(
          "Clear completed",
          () => {
            tasks = tasks.filter((t) => !t.done);
            persist();
          },
          "link-button",
        ),
      ),
    );
    status.textContent = `${events.length} appointments · ${tasks.filter((t) => !t.done).length} tasks remaining`;
  }
  const exportICS = async () => {
    const blob = new Blob([exportCalendar(events)], {
      type: "text/calendar;charset=utf-8",
    });
    const path = d.fs.uniquePath("C:/Users/User/Documents", "My Calendar.ics");
    d.fs.write(path, await blob.text(), "text/calendar");
    downloadBlob(blob, "My Calendar.ics");
  };
  const importICS = async () => {
    const files = await chooseFiles({ accept: ".ics,text/calendar" });
    if (!files[0]) return;
    try {
      const incoming = importCalendar(await files[0].text()),
        ids = new Set(events.map((e) => e.id));
      events.push(
        ...incoming.filter((e) => {
          if (ids.has(e.id)) return false;
          ids.add(e.id);
          return true;
        }),
      );
      persist();
      d.toast(
        "Calendar imported",
        incoming.length + " appointments read.",
        "calendar",
      );
    } catch (e) {
      d.dialog.error(e);
    }
  };
  win.body.append(
    menuBar([
      {
        label: "File",
        items: [
          { label: "New Appointment", action: () => appointment() },
          { label: "New Task", action: newTask },
          { label: "Import…", action: importICS },
          { label: "Export…", action: exportICS },
          { label: "Print…", action: () => window.print() },
          { label: "Exit", action: () => win.close() },
        ],
      },
      {
        label: "View",
        items: [
          {
            label: "Go to Today",
            action: () => {
              displayed = new Date();
              render();
            },
          },
          {
            label: "Previous Month",
            action: () => {
              displayed = new Date(
                displayed.getFullYear(),
                displayed.getMonth() - 1,
                1,
              );
              render();
            },
          },
          {
            label: "Next Month",
            action: () => {
              displayed = new Date(
                displayed.getFullYear(),
                displayed.getMonth() + 1,
                1,
              );
              render();
            },
          },
        ],
      },
      {
        label: "Help",
        items: [
          {
            label: "About Windows Calendar",
            action: () =>
              d.dialog.message(
                "Windows Calendar",
                "Create appointments, recurring events, and tasks.\nImport and export iCalendar (.ics) files.\nYour calendars are stored on this device.",
              ),
          },
        ],
      },
    ]),
    h(
      "div",
      { class: "toolbar" },
      tool("New Appointment", "calendar", () => appointment()),
      tool("New Task", "documents", newTask),
      tool("Import", "folder", importICS),
      tool("Export", "drive", exportICS),
    ),
    h("div", { class: "calendar-layout" }, side, main),
    status,
  );
  main.append(heading, grid);
  render();
  return win;
}

function contacts(d, args = {}) {
  let entries = d.settings.get("contacts", []),
    query = "";
  const win = d.wm.create({
      title: "Windows Contacts",
      icon: "contacts",
      appId: "contacts",
      width: 720,
      height: 480,
      remember: true,
    }),
    grid = h("div", { class: "contacts-grid" }),
    search = h("input", {
      class: "vista-input",
      placeholder: "Search Contacts",
      "aria-label": "Search Contacts",
    }),
    status = statusBar("");
  async function edit(existing = null) {
    const contact = existing || {
        id: crypto.randomUUID(),
        name: "",
        email: "",
        phone: "",
        address: "",
        notes: "",
      },
      fields = {};
    for (const key of ["name", "email", "phone", "address", "notes"])
      fields[key] = h(key === "notes" ? "textarea" : "input", {
        class: "vista-input",
        value: contact[key] || "",
        type: key === "email" ? "email" : "text",
      });
    const result = await d.dialog.form({
      title: existing ? "Contact Properties" : "New Contact",
      width: 460,
      body: h(
        "div",
        {},
        ...Object.entries(fields).map(([key, input]) =>
          field(key[0].toUpperCase() + key.slice(1) + ":", input),
        ),
      ),
      focus: fields.name,
      buttons: [
        { label: "Save", value: "save", primary: true },
        ...(existing ? [{ label: "Delete", value: "delete" }] : []),
        { label: "Cancel", value: null },
      ],
    });
    entries = d.settings.get("contacts", []);
    if (result === "delete") {
      entries = entries.filter((e) => e.id !== contact.id);
      persist();
    }
    if (result === "save" && fields.name.value.trim()) {
      entries = entries.filter((e) => e.id !== contact.id);
      entries.push({
        ...contact,
        ...Object.fromEntries(
          Object.entries(fields).map(([k, v]) => [k, v.value.trim()]),
        ),
      });
      persist();
    }
  }
  const persist = () => {
    d.settings.set("contacts", entries);
    render();
  };
  function render() {
    grid.replaceChildren();
    for (const entry of entries
      .filter((e) =>
        (e.name + " " + e.email).toLowerCase().includes(query.toLowerCase()),
      )
      .sort((a, b) => a.name.localeCompare(b.name)))
      grid.append(
        button(
          [
            icon("contacts", 48),
            h(
              "span",
              {},
              entry.name,
              h("small", {}, entry.email || entry.phone),
            ),
          ],
          () => (args.choose ? args.choose(entry) : edit(entry)),
          "contact-card",
        ),
      );
    if (!entries.length)
      grid.append(
        h(
          "div",
          { class: "app-note", style: { gridColumn: "1/-1" } },
          "Add a contact to keep names, email addresses, and phone numbers together.",
        ),
      );
    status.textContent = entries.length + " contacts";
  }
  const exportVCF = () => {
    const esc = (text) =>
      String(text || "")
        .replaceAll("\\", "\\\\")
        .replaceAll("\n", "\\n")
        .replaceAll(";", "\\;")
        .replaceAll(",", "\\,");
    const text = entries
      .map((c) =>
        [
          "BEGIN:VCARD",
          "VERSION:3.0",
          "FN:" + esc(c.name),
          "EMAIL:" + esc(c.email),
          "TEL:" + esc(c.phone),
          "ADR:;;" + esc(c.address) + ";;;;",
          "NOTE:" + esc(c.notes),
          "END:VCARD",
        ].join("\r\n"),
      )
      .join("\r\n");
    downloadBlob(new Blob([text], { type: "text/vcard" }), "Contacts.vcf");
  };
  const importVCF = async () => {
    const files = await chooseFiles({ accept: ".vcf,text/vcard" });
    if (!files[0]) return;
    const text = (await files[0].text()).replace(/\r?\n[ \t]/g, "");
    for (const raw of text.split("BEGIN:VCARD").slice(1)) {
      const c = {
        id: crypto.randomUUID(),
        name: "",
        email: "",
        phone: "",
        address: "",
        notes: "",
      };
      for (const line of raw.split(/\r?\n/)) {
        const pos = line.indexOf(":");
        if (pos < 0) continue;
        const key = line.slice(0, pos).split(";")[0].toUpperCase(),
          value = line
            .slice(pos + 1)
            .replace(/\\n/gi, "\n")
            .replace(/\\([,;\\])/g, "$1");
        if (key === "FN") c.name = value;
        if (key === "EMAIL") c.email = value;
        if (key === "TEL") c.phone = value;
        if (key === "ADR")
          c.address = value.split(";").filter(Boolean).join(", ");
        if (key === "NOTE") c.notes = value;
      }
      if (c.name) entries.push(c);
    }
    persist();
  };
  d.settings.on(
    "change",
    ({ key }) => {
      if (key === "contacts") {
        entries = d.settings.get("contacts", []);
        render();
      }
    },
    win.signal,
  );
  search.oninput = () => {
    query = search.value;
    render();
  };
  win.body.append(
    h(
      "div",
      { class: "toolbar" },
      tool("New Contact", "contacts", () => edit()),
      tool("Import", "folder", importVCF),
      tool("Export", "drive", exportVCF),
      h("span", { class: "spacer" }),
      search,
    ),
    grid,
    status,
  );
  render();
  return win;
}

function mail(d, args = {}) {
  let messages = d.settings.get("mailMessages", null);
  if (!messages) {
    messages = [
      {
        id: crypto.randomUUID(),
        folder: "Inbox",
        from: "Windows Mail",
        to: "User",
        subject: "Welcome to Windows Mail",
        body: "Welcome to Windows Mail.\n\nKeep local drafts and imported messages together, and use Windows Contacts for your address book.\n\nTo compose a real email, choose Create Mail. Send opens your configured email application with the message prepared. You can also export a message as an .eml file.\n\nThis browser desktop does not have an email server connected.",
        date: Date.now(),
        read: false,
      },
    ];
    d.settings.set("mailMessages", messages);
  }
  const win = d.wm.create({
      title: "Windows Mail",
      icon: "mail",
      appId: "mail",
      width: 900,
      height: 600,
      remember: true,
    }),
    folders = h("div", { class: "mail-folders" }),
    list = h("div", { class: "mail-messages" }),
    preview = h("div", { class: "mail-preview" }),
    status = statusBar(""),
    search = h("input", {
      class: "vista-input",
      placeholder: "Search mail",
      "aria-label": "Search mail",
    });
  let folder = "Inbox",
    selected = messages[0]?.id,
    query = "";
  const persist = () => {
    d.settings.set("mailMessages", messages);
    if (!win.closed) render();
  };
  const current = () => messages.find((m) => m.id === selected);
  function render() {
    folders.replaceChildren(
      h("b", { style: { display: "block", padding: "8px" } }, "Local Folders"),
    );
    for (const f of ["Inbox", "Outbox", "Drafts", "Deleted Items"])
      folders.append(
        button(
          [
            icon(f === "Deleted Items" ? "recycle" : "folder", 16),
            f,
            h("span", { class: "spacer" }),
            String(messages.filter((m) => m.folder === f).length),
          ],
          () => {
            folder = f;
            selected = messages.find((m) => m.folder === f)?.id;
            render();
          },
          f === folder ? "active" : "",
        ),
      );
    const rows = messages
        .filter(
          (m) =>
            m.folder === folder &&
            (m.subject + " " + m.from + " " + m.body)
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) => b.date - a.date),
      table = h(
        "table",
        { class: "data-table" },
        h(
          "thead",
          {},
          h(
            "tr",
            {},
            h("th", { style: { width: "24%" } }, "From"),
            h("th", { style: { width: "52%" } }, "Subject"),
            h("th", {}, "Received"),
          ),
        ),
      ),
      body = h("tbody", {});
    for (const m of rows) {
      const row = h(
        "tr",
        {
          class: m.id === selected ? "selected" : "",
          style: { fontWeight: m.read ? "400" : "600" },
          onclick: () => {
            selected = m.id;
            m.read = true;
            persist();
          },
          ondblclick: () => {
            if (m.folder === "Drafts") compose(m);
          },
        },
        h("td", {}, m.from),
        h("td", {}, m.subject),
        h("td", {}, new Date(m.date).toLocaleDateString()),
      );
      body.append(row);
    }
    table.append(body);
    list.replaceChildren(table);
    preview.replaceChildren();
    const m = current();
    if (m && m.folder === folder)
      preview.append(
        h("h2", {}, m.subject),
        h(
          "div",
          { class: "mail-meta" },
          h("div", {}, "From: " + m.from),
          h("div", {}, "To: " + m.to),
          h("div", {}, "Sent: " + new Date(m.date).toLocaleString()),
        ),
        h(
          "div",
          { style: { whiteSpace: "pre-wrap", lineHeight: "1.6" } },
          m.body,
        ),
        ...(m.attachments?.length
          ? [
              h(
                "div",
                { class: "app-note" },
                ...m.attachments.map((path) =>
                  button(basename(path), () => d.openFile(path), "link-button"),
                ),
              ),
            ]
          : []),
      );
    status.textContent = rows.length + " message(s) · Local Folders";
  }
  const eml = async (message) => {
    const clean = (v) => String(v || "").replace(/[\r\n]/g, " "),
      headers = [
        `From: ${clean(message.from)}`,
        `To: ${clean(message.to)}`,
        `Subject: ${clean(message.subject)}`,
        `Date: ${new Date(message.date).toUTCString()}`,
        "MIME-Version: 1.0",
      ];
    if (!message.attachments?.length)
      return new Blob(
        [
          [
            ...headers,
            "Content-Type: text/plain; charset=UTF-8",
            "",
            message.body,
          ].join("\r\n"),
        ],
        { type: "message/rfc822" },
      );
    const boundary = "vista-" + crypto.randomUUID();
    headers.push(
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      "--" + boundary,
      "Content-Type: text/plain; charset=UTF-8",
      "",
      message.body,
    );
    for (const path of message.attachments) {
      const file = d.fs.stat(path);
      if (!file) throw new Error("Attachment is missing: " + basename(path));
      const blob = await d.fs.exportBlob(path),
        bytes = new Uint8Array(await blob.arrayBuffer());
      let str = "";
      for (const b of bytes) str += String.fromCharCode(b);
      const encoded = (btoa(str).match(/.{1,76}/g) || []).join("\r\n");
      headers.push(
        "--" + boundary,
        "Content-Type: " + (file.mime || "application/octet-stream"),
        `Content-Disposition: attachment; filename="${clean(file.name).replaceAll('"', "")}"`,
        "Content-Transfer-Encoding: base64",
        "",
        encoded,
      );
    }
    headers.push("--" + boundary + "--", "");
    return new Blob([headers.join("\r\n")], { type: "message/rfc822" });
  };
  async function compose(existing = null, reply = false) {
    const draft =
        existing && existing.folder === "Drafts"
          ? { ...existing }
          : {
              id: crypto.randomUUID(),
              folder: "Drafts",
              from: d.settings.get("userName", "User"),
              to: reply ? existing?.from || "" : args.to || "",
              subject: reply
                ? "Re: " + (existing?.subject || "")
                : args.subject || "",
              body: reply
                ? "\n\n----- Original Message -----\n" + (existing?.body || "")
                : args.body || "",
              date: Date.now(),
              read: true,
              attachments: [],
            },
      edit = d.wm.create({
        title: (draft.subject || "New Message") + " - Windows Mail",
        icon: "mail",
        appId: "compose",
        width: 720,
        height: 515,
      }),
      to = h("input", {
        class: "vista-input",
        value: draft.to,
        "aria-label": "To",
      }),
      subject = h("input", {
        class: "vista-input",
        value: draft.subject,
        "aria-label": "Subject",
      }),
      text = h("textarea", {
        class: "compose-text",
        value: draft.body,
        "aria-label": "Message body",
      }),
      attachments = h("div", { class: "toolbar" });
    let paths = [...(draft.attachments || [])];
    const snapshot = () => ({
        ...draft,
        to: to.value,
        subject: subject.value || "(no subject)",
        body: text.value,
        date: Date.now(),
        attachments: [...paths],
      }),
      saveDraft = () => {
        const value = snapshot();
        messages = d.settings
          .get("mailMessages", [])
          .filter((m) => m.id !== value.id);
        messages.push({ ...value, folder: "Drafts" });
        edit.dirty = false;
        persist();
        d.toast("Draft saved", value.subject, "mail");
      },
      exportEML = async () =>
        downloadBlob(
          await eml(snapshot()),
          (subject.value || "Message").replace(/[^\w .-]/g, "_") + ".eml",
        );
    const updateAttachments = () => {
      attachments.replaceChildren(
        ...paths.map((path) =>
          button(
            [icon("documents", 16), basename(path), " ×"],
            () => {
              paths = paths.filter((p) => p !== path);
              updateAttachments();
              edit.dirty = true;
            },
            "toolbar-button",
          ),
        ),
      );
      attachments.hidden = !paths.length;
    };
    const attach = async () => {
      const path = await d.dialog.file({ path: "C:/Users/User/Documents" });
      if (path && !paths.includes(path)) {
        paths.push(path);
        edit.dirty = true;
        updateAttachments();
      }
    };
    const send = async () => {
      if (!to.value.trim()) {
        d.dialog.message("Windows Mail", "Enter a recipient in the To box.");
        to.focus();
        return;
      }
      const value = snapshot();
      if (paths.length) {
        await exportEML();
        d.dialog.message(
          "Windows Mail",
          "The message and attachments were exported as an .eml file. Open it in your email application to send it.",
        );
        return;
      }
      messages = d.settings
        .get("mailMessages", [])
        .filter((m) => m.id !== value.id);
      messages.push({ ...value, folder: "Outbox" });
      persist();
      edit.dirty = false;
      const link = document.createElement("a");
      link.href =
        "mailto:" +
        encodeURIComponent(to.value) +
        "?subject=" +
        encodeURIComponent(value.subject) +
        "&body=" +
        encodeURIComponent(value.body);
      link.click();
      d.toast(
        "Message prepared",
        "Your email application will open to complete sending.",
        "mail",
      );
    };
    edit.body.append(
      h(
        "div",
        { class: "toolbar" },
        tool("Send", "mail", send),
        tool("Save Draft", "drive", saveDraft),
        tool("Attach", "documents", attach),
        tool("Export EML", "folder", exportEML),
      ),
      h(
        "div",
        { class: "compose-fields" },
        field("To:", to),
        field("Subject:", subject),
      ),
      attachments,
      text,
      statusBar("Plain text message"),
    );
    for (const el of [to, subject, text])
      el.oninput = () => (edit.dirty = true);
    edit.beforeClose = async () => {
      if (!edit.dirty) return true;
      const choice = await d.dialog.message(
        "Windows Mail",
        "Save this message as a draft?",
        {
          buttons: [
            { label: "Save", value: "save", primary: true },
            { label: "Discard", value: "discard" },
            { label: "Cancel", value: null },
          ],
        },
      );
      if (choice === "save") saveDraft();
      return !!choice;
    };
    edit.el.onkeydown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveDraft();
      }
    };
    updateAttachments();
    to.focus();
  }
  const remove = () => {
    messages = d.settings.get("mailMessages", []);
    const m = current();
    if (!m) return;
    if (folder === "Deleted Items")
      messages = messages.filter((x) => x.id !== m.id);
    else m.folder = "Deleted Items";
    selected = null;
    persist();
  };
  const importEML = async () => {
    const files = await chooseFiles({
      accept: ".eml,message/rfc822",
      multiple: true,
    });
    for (const file of files) {
      const text = await file.text(),
        [header, ...body] = text.split(/\r?\n\r?\n/),
        unfold = header.replace(/\r?\n[ \t]+/g, " "),
        get = (name) =>
          new RegExp("^" + name + ":\\s*(.*)$", "mi").exec(unfold)?.[1] || "";
      if (/^multipart\//i.test(get("Content-Type"))) {
        d.dialog.message(
          "Import Messages",
          "Multipart email import is not supported. Import a plain text .eml message; exported attachments can be opened in your email application.",
        );
        continue;
      }
      messages = d.settings.get("mailMessages", messages);
      messages.push({
        id: crypto.randomUUID(),
        folder: "Inbox",
        from: get("From") || "Unknown sender",
        to: get("To"),
        subject: get("Subject") || file.name,
        body: body.join("\n\n"),
        date: Date.parse(get("Date")) || Date.now(),
        read: false,
      });
    }
    persist();
  };
  d.settings.on(
    "change",
    ({ key }) => {
      if (key === "mailMessages") {
        messages = d.settings.get("mailMessages", []);
        render();
      }
    },
    win.signal,
  );
  search.oninput = () => {
    query = search.value;
    render();
  };
  win.body.append(
    menuBar([
      {
        label: "File",
        items: [
          { label: "New Mail Message", action: () => compose() },
          { label: "Import Messages…", action: importEML },
          {
            label: "Export Message…",
            action: async () => {
              if (current()) downloadBlob(await eml(current()), "Message.eml");
            },
          },
          { label: "Exit", action: () => win.close() },
        ],
      },
      {
        label: "Edit",
        items: [
          { label: "Delete", action: remove },
          {
            label: "Mark as Unread",
            action: () => {
              if (current()) {
                current().read = false;
                persist();
              }
            },
          },
        ],
      },
      {
        label: "Tools",
        items: [
          { label: "Windows Contacts", action: () => d.open("contacts") },
          {
            label: "Accounts",
            action: () =>
              d.dialog.message(
                "Mail Accounts",
                "This desktop stores drafts and imported messages locally.\nSend opens your configured email application; no mail server is connected to this browser desktop.",
              ),
          },
        ],
      },
    ]),
    h(
      "div",
      { class: "toolbar" },
      tool("Create Mail", "mail", () => compose()),
      tool("Reply", "mail", () => {
        if (current()) compose(current(), true);
      }),
      tool("Delete", "recycle", remove),
      tool("Contacts", "contacts", () => d.open("contacts")),
      tool("Import", "folder", importEML),
      h("span", { class: "spacer" }),
      search,
    ),
    h(
      "div",
      { class: "mail-layout" },
      folders,
      h("div", { class: "mail-content" }, list, preview),
    ),
    status,
  );
  render();
  if (args.to || args.subject || args.body) compose();
  return win;
}
