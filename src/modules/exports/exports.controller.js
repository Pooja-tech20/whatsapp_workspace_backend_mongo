import * as service from "./exports.service.js";

const organizationId = (req) => req.organization?._id ?? req.user?.organizationId;
const sendError = (res, error) => res.status(error.statusCode || 500).json({ success: false, message: error.message || "Export request failed" });

export async function getDestinations(req, res) {
  try { return res.json({ success: true, data: await service.listDestinations(organizationId(req)) }); }
  catch (e) { return sendError(res, e); }
}
export async function postDestination(req, res) {
  try {
    const { name, host, port, username, password, remotePath } = req.body || {};
    if (![name, host, username, password].every((v) => typeof v === "string" && v.trim()))
      return res.status(400).json({ success: false, message: "name, host, username, and password are required" });
    const data = await service.createDestination(organizationId(req), { name, host, port, username, password, remotePath });
    return res.status(201).json({ success: true, data });
  } catch (e) { return sendError(res, e); }
}
export async function patchDestination(req, res) {
  try {
    const allowed = ["name", "host", "port", "username", "password", "remotePath", "isActive"];
    const input = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => allowed.includes(k)));
    const data = await service.updateDestination(organizationId(req), req.params.id, input);
    return data ? res.json({ success: true, data }) : res.status(404).json({ success: false, message: "Destination not found" });
  } catch (e) { return sendError(res, e); }
}
export async function removeDestination(req, res) {
  try {
    const removed = await service.deleteDestination(organizationId(req), req.params.id);
    return removed ? res.json({ success: true, message: "Destination deleted" }) : res.status(404).json({ success: false, message: "Destination not found" });
  } catch (e) { return sendError(res, e); }
}
export async function getHistory(req, res) {
  try { return res.json({ success: true, data: await service.listHistory(organizationId(req), req.query.limit) }); }
  catch (e) { return sendError(res, e); }
}
export async function runExport(req, res) {
  try {
    const { destinationId } = req.body || {};
    if (!destinationId) return res.status(400).json({ success: false, message: "destinationId is required" });
    const result = await service.prepareExport({ organizationId: organizationId(req), userId: req.user._id, destinationId });
    // Return CSV for download while recording the job. SFTP delivery needs the SFTP transport configured separately.
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
    res.setHeader("X-Export-History-Id", String(result.historyId));
    return res.status(200).send(result.csv);
  } catch (e) { return sendError(res, e); }
}
