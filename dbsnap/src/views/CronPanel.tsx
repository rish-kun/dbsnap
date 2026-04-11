import React, { useState, useEffect } from "react";
import { useKeyboard } from "@opentui/react";
import { setupCronJob, listCronJobs, removeCronJob } from "../services/cron";
import { getDockerContainers, getDatabases } from "../services/docker";
import { LogViewer } from "../components/LogViewer";

export interface CronJobConfig {
  id: string;
  frequencyType: "hourly" | "daily" | "weekly" | "monthly" | "custom";
  customCron?: string;
  dbHostType: "local" | "remote";
  port: string;
  dockerContainer: string;
  dbName: string;
}

interface CronPanelProps {
  config: Record<string, string>;
  isFocused: boolean;
  logs: string[];
  setLogs: React.Dispatch<React.SetStateAction<string[]>>;
}

const frequencyOptions = [
  { value: "hourly", label: "Hourly", cron: "0 * * * *" },
  { value: "daily", label: "Daily (Midnight)", cron: "0 0 * * *" },
  { value: "weekly", label: "Weekly (Sunday)", cron: "0 0 * * 0" },
  { value: "monthly", label: "Monthly (1st)", cron: "0 0 1 * *" },
  { value: "custom", label: "Custom", cron: "" },
];

type FormField = "frequency" | "customCron" | "dbHost" | "port" | "container" | "database";

export function CronPanel({ config, isFocused, logs, setLogs }: CronPanelProps) {
  const [cronJobs, setCronJobs] = useState<CronJobConfig[]>([]);
  const [selectedJobIndex, setSelectedJobIndex] = useState<number>(-1);
  const [viewMode, setViewMode] = useState<"list" | "edit" | "add">("list");
  const [formData, setFormData] = useState<CronJobConfig>({
    id: "",
    frequencyType: "daily",
    customCron: "",
    dbHostType: "local",
    port: "5432",
    dockerContainer: "",
    dbName: "postgres",
  });
  const [focusedField, setFocusedField] = useState<FormField>("frequency");
  const [containerSelectorMode, setContainerSelectorMode] = useState(false);
  const [containerSelectorIndex, setContainerSelectorIndex] = useState(0);
  const [availableContainers, setAvailableContainers] = useState<string[]>([]);
  const [dbSelectorMode, setDbSelectorMode] = useState(false);
  const [dbSelectorIndex, setDbSelectorIndex] = useState(0);
  const [availableDbs, setAvailableDbs] = useState<string[]>([]);
  const [dbFetchLoading, setDbFetchLoading] = useState(false);

  useEffect(() => {
    if (viewMode === "add" || viewMode === "edit") {
      getDockerContainers().then(containers => {
        setAvailableContainers(containers);
        if (containers.length > 0 && !formData.dockerContainer) {
          const idx = containers.findIndex(c => c === config.DOCKER_CONTAINER);
          const defaultContainer = idx >= 0 ? containers[idx] : containers[0];
          if (defaultContainer) {
            setFormData(prev => ({ ...prev, dockerContainer: defaultContainer }));
          }
        }
      });
    }
  }, [viewMode]);

  useEffect(() => {
    setAvailableDbs([]);
    setDbSelectorMode(false);
  }, [formData.dockerContainer]);

  const fetchDatabases = async () => {
    const container = formData.dockerContainer;
    if (!container) {
      addLog("❌ Please set container first");
      return;
    }
    setDbFetchLoading(true);
    addLog("Fetching databases...");
    try {
      const dbUser = config.DB_USER || "postgres";
      const dbs = await getDatabases(container, dbUser);
      setAvailableDbs(dbs);
      setDbSelectorIndex(dbs.indexOf(formData.dbName) >= 0 ? dbs.indexOf(formData.dbName) : 0);
      addLog(`Found ${dbs.length} databases`);
    } catch (err: any) {
      addLog(`Failed to fetch databases: ${err.message}`);
      setAvailableDbs([]);
    } finally {
      setDbFetchLoading(false);
    }
  };

  const formFields: FormField[] = ["frequency", "customCron", "dbHost", "port", "container", "database"];

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const getCronExpression = (freqType: string, custom?: string): string => {
    const opt = frequencyOptions.find(f => f.value === freqType);
    if (freqType === "custom" && custom) return custom;
    return opt?.cron || "0 0 * * *";
  };

  const handleAddNew = () => {
    setFormData({
      id: Date.now().toString(),
      frequencyType: "daily",
      customCron: "",
      dbHostType: "local",
      port: "5432",
      dockerContainer: config.DOCKER_CONTAINER || "",
      dbName: config.DB_NAME || "postgres",
    });
    setViewMode("add");
    setSelectedJobIndex(-1);
    setFocusedField("frequency");
  };

  const handleEdit = (index: number) => {
    const job = cronJobs[index];
    if (!job) return;
    setFormData(job);
    setViewMode("edit");
    setSelectedJobIndex(index);
    setFocusedField("frequency");
  };

  const handleSave = async () => {
    try {
      const cronExpr = getCronExpression(formData.frequencyType, formData.customCron);
      const containerName = formData.dockerContainer;
      
      addLog(`Setting up cron job for container: ${containerName}...`);
      addLog(`Frequency: ${formData.frequencyType} (${cronExpr})`);
      addLog(`Database: ${formData.dbHostType}:${formData.port} - ${formData.dbName}`);
      
      await setupCronJob(cronExpr, containerName, formData.dbHostType, formData.port, formData.dbName, addLog);
      
      if (viewMode === "add") {
        setCronJobs(prev => [...prev, formData]);
      } else if (viewMode === "edit" && selectedJobIndex >= 0) {
        setCronJobs(prev => prev.map((job, i) => i === selectedJobIndex ? formData : job));
      }
      
      setViewMode("list");
      addLog("✅ Cron job saved successfully.");
    } catch (e: any) {
      addLog(`❌ Failed to save cron job: ${e.message}`);
    }
  };

  const handleDelete = async (index: number) => {
    const job = cronJobs[index];
    if (!job) return;
    try {
      await removeCronJob(job.dockerContainer, addLog);
      setCronJobs(prev => prev.filter((_, i) => i !== index));
      addLog(`✅ Cron job for ${job.dockerContainer} removed.`);
    } catch (e: any) {
      addLog(`❌ Failed to remove cron job: ${e.message}`);
    }
  };

  const handleRefreshCronJobs = async () => {
    try {
      const jobs = await listCronJobs(addLog);
      addLog(`Found ${jobs.length} existing cron job(s)`);
    } catch (e: any) {
      addLog(`❌ Failed to list cron jobs: ${e.message}`);
    }
  };

  const handleListNavigation = (keyName: string) => {
    if (cronJobs.length === 0) {
      setSelectedJobIndex(-1);
      return;
    }

    if (keyName === "down" || keyName === "tab") {
      setSelectedJobIndex(prev => {
        if (prev < 0) return 0;
        return (prev + 1) % cronJobs.length;
      });
    } else if (keyName === "up") {
      setSelectedJobIndex(prev => {
        if (prev < 0) return cronJobs.length - 1;
        return (prev - 1 + cronJobs.length) % cronJobs.length;
      });
    }
  };

  const handleFormNavigation = (keyName: string) => {
    const currentIndex = formFields.indexOf(focusedField);
    
    if (keyName === "down" || keyName === "tab") {
      let nextIndex = (currentIndex + 1) % formFields.length;
      let nextField = formFields[nextIndex];
      if (nextField === "customCron" && formData.frequencyType !== "custom") {
        nextIndex = (nextIndex + 1) % formFields.length;
        nextField = formFields[nextIndex];
      }
      if (nextField) {
        setFocusedField(nextField);
        setContainerSelectorMode(false);
        setDbSelectorMode(false);
      }
    } else if (keyName === "up") {
      let prevIndex = (currentIndex - 1 + formFields.length) % formFields.length;
      let prevField = formFields[prevIndex];
      if (prevField === "customCron" && formData.frequencyType !== "custom") {
        prevIndex = (prevIndex - 1 + formFields.length) % formFields.length;
        prevField = formFields[prevIndex];
      }
      if (prevField) {
        setFocusedField(prevField);
        setContainerSelectorMode(false);
        setDbSelectorMode(false);
      }
    } else if (keyName === "right") {
      if (focusedField === "frequency") {
        const idx = frequencyOptions.findIndex(f => f.value === formData.frequencyType);
        const nextIdx = (idx + 1) % frequencyOptions.length;
        setFormData(prev => ({ ...prev, frequencyType: frequencyOptions[nextIdx]?.value as CronJobConfig["frequencyType"] || "daily" }));
      } else if (focusedField === "dbHost") {
        setFormData(prev => ({ ...prev, dbHostType: prev.dbHostType === "local" ? "remote" : "local" }));
      } else if (focusedField === "container" && availableContainers.length > 0) {
        const idx = availableContainers.indexOf(formData.dockerContainer);
        const nextIdx = idx >= 0 ? (idx + 1) % availableContainers.length : 0;
        const nextContainer = availableContainers[nextIdx];
        if (nextContainer) setFormData(prev => ({ ...prev, dockerContainer: nextContainer }));
      } else if (focusedField === "database" && availableDbs.length > 0) {
        const idx = availableDbs.indexOf(formData.dbName);
        const nextIdx = idx >= 0 ? (idx + 1) % availableDbs.length : 0;
        const nextDb = availableDbs[nextIdx];
        if (nextDb) setFormData(prev => ({ ...prev, dbName: nextDb }));
      }
    } else if (keyName === "left") {
      if (focusedField === "frequency") {
        const idx = frequencyOptions.findIndex(f => f.value === formData.frequencyType);
        const prevIdx = (idx - 1 + frequencyOptions.length) % frequencyOptions.length;
        setFormData(prev => ({ ...prev, frequencyType: frequencyOptions[prevIdx]?.value as CronJobConfig["frequencyType"] || "daily" }));
      } else if (focusedField === "dbHost") {
        setFormData(prev => ({ ...prev, dbHostType: prev.dbHostType === "local" ? "remote" : "local" }));
      } else if (focusedField === "container" && availableContainers.length > 0) {
        const idx = availableContainers.indexOf(formData.dockerContainer);
        const prevIdx = idx > 0 ? idx - 1 : availableContainers.length - 1;
        const prevContainer = availableContainers[prevIdx];
        if (prevContainer) setFormData(prev => ({ ...prev, dockerContainer: prevContainer }));
      } else if (focusedField === "database" && availableDbs.length > 0) {
        const idx = availableDbs.indexOf(formData.dbName);
        const prevIdx = idx > 0 ? idx - 1 : availableDbs.length - 1;
        const prevDb = availableDbs[prevIdx];
        if (prevDb) setFormData(prev => ({ ...prev, dbName: prevDb }));
      }
    }
  };

  const handleContainerSelector = (keyName: string) => {
    if (availableContainers.length === 0) return;
    const selectedContainer = availableContainers[containerSelectorIndex];
    if (!selectedContainer) return;

    if (keyName === "down" || keyName === "tab") {
      setContainerSelectorIndex(prev => (prev + 1) % availableContainers.length);
    } else if (keyName === "up") {
      setContainerSelectorIndex(prev => (prev - 1 + availableContainers.length) % availableContainers.length);
    } else if (keyName === "return") {
      setFormData(prev => ({ ...prev, dockerContainer: selectedContainer }));
      setContainerSelectorMode(false);
    } else if (keyName === "escape") {
      setContainerSelectorMode(false);
    }
  };

  const handleDbSelector = (keyName: string) => {
    if (availableDbs.length === 0) return;
    const selectedDb = availableDbs[dbSelectorIndex];
    if (!selectedDb) return;

    if (keyName === "down" || keyName === "tab") {
      setDbSelectorIndex(prev => (prev + 1) % availableDbs.length);
    } else if (keyName === "up") {
      setDbSelectorIndex(prev => (prev - 1 + availableDbs.length) % availableDbs.length);
    } else if (keyName === "return") {
      setFormData(prev => ({ ...prev, dbName: selectedDb }));
      setDbSelectorMode(false);
    } else if (keyName === "escape") {
      setDbSelectorMode(false);
    } else if (keyName === "r") {
      fetchDatabases();
    }
  };

  useKeyboard((key) => {
    if (!isFocused) return;

    if (key.ctrl && key.name === "j") return;

    if (viewMode === "list") {
      if (key.name === "down" || key.name === "tab" || key.name === "up") {
        handleListNavigation(key.name);
      } else if (key.name === "return") {
        if (cronJobs.length > 0 && selectedJobIndex >= 0) {
          handleEdit(selectedJobIndex);
        } else {
          handleAddNew();
        }
      } else if (key.ctrl && key.name === "n") {
        handleAddNew();
      } else if (key.ctrl && key.name === "r") {
        handleRefreshCronJobs();
      } else if (key.name === "delete" && selectedJobIndex >= 0) {
        handleDelete(selectedJobIndex);
      }
    } else if (viewMode === "add" || viewMode === "edit") {
      if (containerSelectorMode) {
        if (key.name === "down" || key.name === "tab" || key.name === "up") {
          handleContainerSelector(key.name);
        } else if (key.name === "return") {
          const selectedContainer = availableContainers[containerSelectorIndex];
          if (selectedContainer) {
            setFormData(prev => ({ ...prev, dockerContainer: selectedContainer }));
          }
          setContainerSelectorMode(false);
        } else if (key.name === "escape") {
          setContainerSelectorMode(false);
        }
      } else if (dbSelectorMode) {
        if (key.name === "down" || key.name === "tab" || key.name === "up") {
          handleDbSelector(key.name);
        } else if (key.name === "return") {
          const selectedDb = availableDbs[dbSelectorIndex];
          if (selectedDb) {
            setFormData(prev => ({ ...prev, dbName: selectedDb }));
          }
          setDbSelectorMode(false);
        } else if (key.name === "escape") {
          setDbSelectorMode(false);
        } else if (key.name === "r") {
          fetchDatabases();
        }
      } else if (key.name === "down" || key.name === "tab" || key.name === "up" || key.name === "left" || key.name === "right") {
        handleFormNavigation(key.name);
      } else if (key.name === "return" && focusedField === "container" && availableContainers.length > 0) {
        const idx = availableContainers.indexOf(formData.dockerContainer);
        setContainerSelectorIndex(idx >= 0 ? idx : 0);
        setContainerSelectorMode(true);
      } else if (focusedField === "database") {
        if (key.name === "r") {
          fetchDatabases();
        } else if (key.name === "space" || key.name === "return") {
          if (availableDbs.length > 0) {
            setDbSelectorIndex(availableDbs.indexOf(formData.dbName) >= 0 ? availableDbs.indexOf(formData.dbName) : 0);
            setDbSelectorMode(true);
          } else {
            fetchDatabases();
          }
        }
      } else if (key.ctrl && key.name === "s") {
        handleSave();
      } else if (key.ctrl && key.name === "escape") {
        setViewMode("list");
      } else if (key.name === "escape") {
        setViewMode("list");
      }
    }
  });

  const renderForm = () => {
    const isCustomFreq = formData.frequencyType === "custom";
    
    return (
      <box style={{ flexDirection: "column", gap: 1, padding: 1, border: true, borderColor: "#333" }}>
        <text bold fg="#00FF00">{viewMode === "add" ? "➕ Add New Cron Job" : "✏️ Edit Cron Job"}</text>
        
        <box style={{ flexDirection: "row", marginTop: 1 }}>
          <text fg={focusedField === "frequency" ? "#0F0" : "#666"} style={{ width: 18 }}>Frequency:</text>
          <text fg="#FFF">{formData.frequencyType}</text>
        </box>
        <text fg="#444" style={{ marginLeft: 18 }}>[←/→] Change frequency</text>

        {isCustomFreq && (
          <box style={{ flexDirection: "row" }}>
            <text fg={focusedField === "customCron" ? "#0F0" : "#666"} style={{ width: 18 }}>Custom Cron:</text>
            <input
              value={formData.customCron || ""}
              onInput={(val: string) => setFormData(prev => ({ ...prev, customCron: val }))}
              focused={focusedField === "customCron"}
              placeholder="* * * * *"
            />
          </box>
        )}

        <box style={{ flexDirection: "row", marginTop: 1 }}>
          <text fg={focusedField === "dbHost" ? "#0F0" : "#666"} style={{ width: 18 }}>DB Host Type:</text>
          <text fg="#FFF">{formData.dbHostType}</text>
        </box>
        <text fg="#444" style={{ marginLeft: 18 }}>[←/→] Toggle local/remote</text>

        <box style={{ flexDirection: "row" }}>
          <text fg={focusedField === "port" ? "#0F0" : "#666"} style={{ width: 18 }}>Port:</text>
          <input
            value={formData.port}
            onInput={(val: string) => setFormData(prev => ({ ...prev, port: val }))}
            focused={focusedField === "port"}
            placeholder="5432"
          />
        </box>

        <box style={{ flexDirection: "row" }}>
          <text fg={focusedField === "container" ? "#0F0" : "#666"} style={{ width: 18 }}>Docker Container:</text>
          {containerSelectorMode ? (
            <text fg="#FFF">{formData.dockerContainer}</text>
          ) : (
            <input
              value={formData.dockerContainer}
              onInput={(val: string) => setFormData(prev => ({ ...prev, dockerContainer: val }))}
              focused={focusedField === "container"}
              placeholder="postgres-container"
            />
          )}
        </box>
        
        {containerSelectorMode && availableContainers.length > 0 && (
          <box style={{ flexDirection: "column", gap: 0, marginLeft: 18, padding: 1, border: true, borderColor: "#0F0" }}>
            {availableContainers.map((container, idx) => (
              <text key={container} fg={idx === containerSelectorIndex ? "#0F0" : "#666"}>
                {idx === containerSelectorIndex ? "▶ " : "  "}{container}
              </text>
            ))}
            <text fg="#444" style={{ marginTop: 1 }}>[↑/↓] Select [Enter] Confirm [Esc] Cancel</text>
          </box>
        )}

        {!containerSelectorMode && (
          <text fg="#444" style={{ marginLeft: 18 }}>[Enter] Show containers | [Type] Custom</text>
        )}

        <box style={{ flexDirection: "row" }}>
          <text fg={focusedField === "database" ? "#0F0" : "#666"} style={{ width: 18 }}>Database:</text>
          {dbSelectorMode ? (
            <text fg="#FFF">{formData.dbName}</text>
          ) : (
            <input
              value={formData.dbName}
              onInput={(val: string) => setFormData(prev => ({ ...prev, dbName: val }))}
              focused={focusedField === "database"}
              placeholder="postgres"
            />
          )}
        </box>

        {dbSelectorMode && (
          <box style={{ flexDirection: "column", marginLeft: 18, padding: 1, border: true, borderColor: "#0F0" }}>
            {dbFetchLoading ? (
              <text fg="#FFA500">Fetching databases...</text>
            ) : availableDbs.length === 0 ? (
              <text fg="#F55">No databases found or container not accessible</text>
            ) : (
              availableDbs.map((db, idx) => (
                <text key={db} fg={idx === dbSelectorIndex ? "#0F0" : "#666"}>
                  {idx === dbSelectorIndex ? "▶ " : "  "}{db}
                </text>
              ))
            )}
            <text fg="#444" style={{ marginTop: 1 }}>[↑/↓] Select [Enter] Confirm [Esc] Cancel [R] Retry</text>
          </box>
        )}

        {!dbSelectorMode && (
          <text fg="#444" style={{ marginLeft: 18 }}>[R] Refresh [Space/Enter] Select</text>
        )}

        <box style={{ flexDirection: "row", marginTop: 1 }}>
          <text fg="#666">[↑/↓] Navigate</text>
          <text fg="#444">  </text>
          <text fg="#666">[←/→] Change</text>
          <text fg="#444">  </text>
          <text fg="#666">[Enter] Container selector</text>
          <text fg="#444">  </text>
          <text fg="#666">[Ctrl+S] Save</text>
          <text fg="#444">  </text>
          <text fg="#666">[Esc] Cancel</text>
        </box>
      </box>
    );
  };

  const renderList = () => (
    <box style={{ flexDirection: "column", gap: 1 }}>
      <box style={{ flexDirection: "row" }}>
        <text bold fg="#00FF00">📅 Cron Jobs</text>
        <text fg="#444">  </text>
        <text fg="#666">({cronJobs.length} job(s))</text>
      </box>

      {cronJobs.length === 0 ? (
        <box style={{ padding: 2, border: true, borderColor: "#333" }}>
          <text fg="#666">No cron jobs configured.</text>
        </box>
      ) : (
        <box style={{ flexDirection: "column", gap: 0 }}>
          {cronJobs.map((job, index) => (
            <box 
              key={job.id} 
              style={{ 
                flexDirection: "row", 
                padding: 0,
                border: selectedJobIndex === index,
                borderColor: selectedJobIndex === index ? "#0F0" : "#333",
              }}
            >
              <text fg={selectedJobIndex === index ? "#0F0" : "#666"}>
                {selectedJobIndex === index ? "▶" : " "}
              </text>
              <text fg="#FFF"> {job.dockerContainer}</text>
              <text fg="#444"> - </text>
              <text fg="#AAA">{job.frequencyType}</text>
              <text fg="#444"> - </text>
              <text fg="#AAA">{job.dbHostType}:{job.port} - {job.dbName}</text>
            </box>
          ))}
        </box>
      )}

      <box style={{ flexDirection: "column", gap: 0, marginTop: 1 }}>
        <text fg="#666">[↑/↓] Navigate</text>
        <text fg="#666">[Enter] Add/Edit</text>
        <text fg="#666">[Ctrl+N] Add New</text>
        <text fg="#666">[Ctrl+R] Refresh</text>
        <text fg="#666">[Del] Delete</text>
      </box>
    </box>
  );

  return (
    <box style={{ flexDirection: "column", gap: 1, height: "100%", overflow: "hidden" }}>
      {viewMode === "list" && renderList()}
      {(viewMode === "add" || viewMode === "edit") && renderForm()}
      
      <LogViewer logs={logs} title="Cron Logs" />
    </box>
  );
}
