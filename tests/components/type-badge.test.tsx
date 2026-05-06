import { render, screen } from "@testing-library/react";
import { TypeBadge } from "@/components/ui/type-badge";

describe("TypeBadge", () => {
  it("renders canonical artifact types as readable labels", () => {
    render(
      <div>
        <TypeBadge type="source_summary" />
        <TypeBadge type="evidence_matrix" />
        <TypeBadge type="implementation_plan" />
      </div>,
    );

    expect(screen.getByLabelText("Type: Source Summary")).toBeInTheDocument();
    expect(screen.getByLabelText("Type: Evidence Matrix")).toBeInTheDocument();
    expect(screen.getByLabelText("Type: Implementation Plan")).toBeInTheDocument();
  });

  it("falls back to title-cased labels for unknown types", () => {
    render(<TypeBadge type="custom_entity_profile" />);

    expect(screen.getByLabelText("Type: Custom Entity Profile")).toBeInTheDocument();
  });
});
