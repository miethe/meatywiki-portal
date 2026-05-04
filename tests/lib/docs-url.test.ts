import { getDocsUrl } from "@/lib/docs-url";

const ORIGINAL_DOCS_URL = process.env.NEXT_PUBLIC_MEATYWIKI_DOCS_URL;

afterEach(() => {
  if (ORIGINAL_DOCS_URL === undefined) {
    delete process.env.NEXT_PUBLIC_MEATYWIKI_DOCS_URL;
  } else {
    process.env.NEXT_PUBLIC_MEATYWIKI_DOCS_URL = ORIGINAL_DOCS_URL;
  }
});

describe("getDocsUrl", () => {
  it("defaults to the local MkDocs dev server", () => {
    delete process.env.NEXT_PUBLIC_MEATYWIKI_DOCS_URL;

    expect(getDocsUrl()).toBe("http://127.0.0.1:8000");
  });

  it("uses the configured docs URL and trims trailing slashes", () => {
    process.env.NEXT_PUBLIC_MEATYWIKI_DOCS_URL = "https://docs.example.com/meatywiki///";

    expect(getDocsUrl()).toBe("https://docs.example.com/meatywiki");
  });
});
