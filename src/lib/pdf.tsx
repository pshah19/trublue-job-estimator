import "server-only";
import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CustomerDoc } from "./customerDoc";
import { fmtMoney } from "./engine/money";

const BLUE = "#0f5bb5";
const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a", lineHeight: 1.4 },
  demo: { backgroundColor: "#fef3c7", color: "#92400e", textAlign: "center", padding: 4, marginBottom: 10, fontSize: 8, fontFamily: "Helvetica-Bold" },
  header: { flexDirection: "row", justifyContent: "space-between", borderBottom: "1 solid #e2e8f0", paddingBottom: 12 },
  logo: { width: 36, height: 36, backgroundColor: BLUE, color: "white", fontFamily: "Helvetica-Bold", fontSize: 14, textAlign: "center", paddingTop: 10, borderRadius: 8 },
  brand: { flexDirection: "row", gap: 8, alignItems: "center" },
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold", textAlign: "right" },
  muted: { color: "#64748b" },
  label: { fontSize: 8, color: "#64748b", fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginBottom: 3 },
  section: { borderBottom: "1 solid #e2e8f0", paddingVertical: 10 },
  two: { flexDirection: "row", gap: 20 },
  col: { flex: 1 },
  bold: { fontFamily: "Helvetica-Bold" },
  total: { fontSize: 20, fontFamily: "Helvetica-Bold", textAlign: "right" },
  sig: { borderBottom: "1 solid #94a3b8", height: 28 },
});

function EstimatePdf({ doc }: { doc: CustomerDoc }) {
  return (
    <Document title={`Estimate ${doc.number}`} author={doc.company.name}>
      <Page size="LETTER" style={s.page}>
        {doc.isDemo && <Text style={s.demo}>SAMPLE — SYNTHETIC DEMO DATA</Text>}
        <View style={s.header}>
          <View style={s.brand}>
            <Text style={s.logo}>TB</Text>
            <View>
              <Text style={[s.bold, { fontSize: 13, color: "#0a2c57" }]}>{doc.company.name}</Text>
              <Text style={s.muted}>{[doc.company.address, doc.company.phone, doc.company.email].filter(Boolean).join(" · ")}</Text>
            </View>
          </View>
          <View>
            <Text style={s.h1}>ESTIMATE</Text>
            <Text style={{ textAlign: "right" }}>{doc.number}</Text>
            <Text style={[s.muted, { textAlign: "right" }]}>Date: {doc.date}</Text>
            <Text style={[s.muted, { textAlign: "right" }]}>Valid until: {doc.validUntil}</Text>
          </View>
        </View>
        <View style={[s.section, s.two]}>
          <View style={s.col}>
            <Text style={s.label}>Prepared for</Text>
            <Text style={s.bold}>{doc.customer.name}</Text>
            {doc.customer.phone ? <Text>{doc.customer.phone}</Text> : null}
            {doc.customer.email ? <Text>{doc.customer.email}</Text> : null}
          </View>
          <View style={s.col}>
            <Text style={s.label}>Property</Text>
            <Text style={s.bold}>{doc.property.address}</Text>
            <Text>{doc.property.zip}</Text>
          </View>
        </View>
        <View style={s.section}>
          <Text style={[s.bold, { fontSize: 13, marginBottom: 6 }]}>{doc.title}</Text>
          <Text style={s.label}>Scope of work — included</Text>
          {doc.scope.map((t, i) => (
            <View key={i} style={{ marginBottom: 4 }} wrap={false}>
              <Text>
                <Text style={[s.bold, { color: BLUE }]}>{i + 1}. </Text>
                <Text style={s.bold}>{t.name}</Text> <Text style={s.muted}>({t.quantity})</Text>
              </Text>
              {t.detail ? <Text style={[s.muted, { marginLeft: 12 }]}>{t.detail}</Text> : null}
            </View>
          ))}
          <Text style={{ marginTop: 4 }}>Includes setup, protection of work areas and cleanup.</Text>
        </View>
        {doc.materials.length > 0 && (
          <View style={s.section}>
            <Text style={s.label}>Materials</Text>
            {doc.materials.map((m, i) => (
              <Text key={i}>• {m.name} — {m.quantity}{m.customerSupplied ? " (supplied by customer)" : ""}</Text>
            ))}
          </View>
        )}
        <View style={[s.section, { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }]} wrap={false}>
          <View>
            <Text style={s.label}>{doc.packageName ?? "Price"}</Text>
            <Text style={s.muted}>{doc.duration}</Text>
            <Text style={[s.muted, { marginTop: 6 }]}>Optional upgrades: none included with this estimate.</Text>
          </View>
          <View>
            <Text style={{ textAlign: "right" }}>Subtotal {fmtMoney(doc.price)}</Text>
            {doc.tax > 0 ? <Text style={{ textAlign: "right" }}>Tax {fmtMoney(doc.tax)}</Text> : null}
            <Text style={s.total}>{fmtMoney(doc.total)}</Text>
          </View>
        </View>
        <View style={[s.section, s.two]}>
          <View style={s.col}>
            <Text style={s.label}>Assumptions</Text>
            {doc.assumptions.map((a, i) => <Text key={i}>• {a}</Text>)}
          </View>
          <View style={s.col}>
            <Text style={s.label}>Exclusions</Text>
            {doc.exclusions.map((a, i) => <Text key={i}>• {a}</Text>)}
          </View>
        </View>
        {doc.licensingNote ? <View style={s.section}><Text style={s.muted}>{doc.licensingNote}</Text></View> : null}
        <View style={s.section} wrap={false}>
          <Text style={s.label}>Payment terms</Text>
          <Text>{doc.paymentTerms}</Text>
          <Text style={[s.label, { marginTop: 6 }]}>Warranty</Text>
          <Text>{doc.warranty}</Text>
          <Text style={[s.muted, { marginTop: 6 }]}>Any additional work discovered during the job will be presented as a written change order for your approval before it proceeds.</Text>
        </View>
        <View style={[s.two, { marginTop: 24 }]} wrap={false}>
          <View style={s.col}><View style={s.sig} /><Text style={s.muted}>Customer signature — I accept this estimate</Text></View>
          <View style={s.col}><View style={s.sig} /><Text style={s.muted}>Date</Text></View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderEstimatePdf(doc: CustomerDoc): Promise<Buffer> {
  return renderToBuffer(<EstimatePdf doc={doc} />);
}
