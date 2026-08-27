{
  description = "Generator-based free DSL showcase for Deno";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      supportedSystems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
    in {
      devShells = forAllSystems (system:
        let pkgs = nixpkgs.legacyPackages.${system};
        in {
          default = pkgs.mkShell {
            packages = [
              pkgs.cabal-install
              pkgs.deno
              pkgs.ghc
              pkgs.perl
            ];
          };
        });

      checks = forAllSystems (system:
        let pkgs = nixpkgs.legacyPackages.${system};
        in {
          deno = pkgs.runCommand "free-dsl-showcase-check" {
            nativeBuildInputs = [ pkgs.deno ];
            src = self;
          } ''
            cp -R "$src" source
            chmod -R u+w source
            cd source
            export DENO_DIR="$TMPDIR/deno"
            deno task check
            deno task test
            touch "$out"
          '';

          haskell = pkgs.haskell.lib.doCheck (
            pkgs.haskellPackages.callCabal2nix
              "free-dsl-showcase-theory"
              ./haskell
              { }
          );

          perl = pkgs.runCommand "free-dsl-showcase-perl-check" {
            nativeBuildInputs = [ pkgs.perl ];
            src = self;
          } ''
            cp -R "$src" source
            cd source
            prove -Iperl/lib perl/t
            touch "$out"
          '';
        });
    };
}
