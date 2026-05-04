import { render, screen } from "@testing-library/react";
import { ShellNav } from "@/app/(main)/shell-nav";

const ORIGINAL_DOCS_URL = process.env.NEXT_PUBLIC_MEATYWIKI_DOCS_URL;

afterEach(() => {
  if (ORIGINAL_DOCS_URL === undefined) {
    delete process.env.NEXT_PUBLIC_MEATYWIKI_DOCS_URL;
  } else {
    process.env.NEXT_PUBLIC_MEATYWIKI_DOCS_URL = ORIGINAL_DOCS_URL;
  }
});

describe("ShellNav Docs link", () => {
  it("renders the Docs button with the local MkDocs URL by default", () => {
    delete process.env.NEXT_PUBLIC_MEATYWIKI_DOCS_URL;

    render(<ShellNav />);

    const docsLink = screen.getByRole("link", { name: /open meatywiki documentation/i });
    expect(docsLink).toHaveAttribute("href", "http://127.0.0.1:8000");
    expect(docsLink).toHaveAttribute("target", "_blank");
  });

  it("uses NEXT_PUBLIC_MEATYWIKI_DOCS_URL when configured", () => {
    process.env.NEXT_PUBLIC_MEATYWIKI_DOCS_URL = "https://docs.example.com/meatywiki";

    render(<ShellNav />);

    expect(screen.getByRole("link", { name: /open meatywiki documentation/i })).toHaveAttribute(
      "href",
      "https://docs.example.com/meatywiki",
    );
  });
});
