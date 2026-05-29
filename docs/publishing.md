# Publishing Checklist

This file is for maintainers.

1. Replace any placeholder repository metadata.
2. Run tests.

```bash
npm test
```

3. Check package contents.

```bash
npm pack --dry-run
```

4. Confirm the package does not include:

- `data/`
- `logs/`
- `cache/`
- `*.sqlite`
- private vault files

5. Push to GitHub and wait for CI to pass on `main`.

6. Publish the pre-1.0 package. The version number communicates preview status; publishing as `latest` keeps the README `npx` install flow simple.

```bash
npm publish --access public
```

7. Create and push the matching git tag.

```bash
git tag v0.1.0
git push origin v0.1.0
```

8. Create a GitHub release for the same tag and mark it as a pre-release.

9. Validate the package install flow from a clean machine or container.
