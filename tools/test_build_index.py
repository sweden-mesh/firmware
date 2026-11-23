#!/usr/bin/env python3
"""Image names as build_index.py reads them: the revision may end in rc or rc<n> (a
pre-release, lou-20rc), and that is never the feature code rc, which is its own token.

    python3 tools/test_build_index.py
"""
import unittest

from build_index import NAME, image

HEAD = "Heltec_v3_repeater_observer_mqtt-esp32s3-v1.18.0-"


def parse(name):
    return image({"name": name, "browser_download_url": "u", "size": 1, "digest": "sha256:ab"})


class Names(unittest.TestCase):
    def test_release(self):
        self.assertEqual(NAME.match(HEAD + "lou-18-arrc-ac8f1a6.bin")["rev"], "18")
        self.assertEqual(parse(HEAD + "lou-18-arrc-ac8f1a6.bin")["features"], "arrc")
        self.assertEqual(parse(HEAD + "lou-18-rc-ac8f1a6.bin")["features"], "rc")

    def test_prerelease_revision_is_not_a_feature(self):
        for rev in ("20rc", "20rc2", "20rc13"):
            for features in ("ar", "rc", "arrc"):
                name = f"{HEAD}lou-{rev}-{features}-ac8f1a6.bin"
                m = NAME.match(name)
                self.assertIsNotNone(m, name)
                self.assertEqual(m["rev"], rev, name)
                self.assertEqual(parse(name)["features"], features, name)

    def test_prerelease_forms(self):
        self.assertEqual(parse(HEAD + "lou-20rc-arrc-ac8f1a6-merged.bin")["form"], "merged")
        self.assertEqual(parse("RAK_4631_repeater-nrf52840-v1.18.0-lou-20rc2-ar-0d1e2f3.zip")["form"], "zip")
        self.assertEqual(parse(HEAD + "lou-20rc-rc-ac8f1a6.bin")["base"], "observer")

    def test_a_name_without_features_is_no_image(self):
        # "rc" glued to the revision is the pre-release mark, so no feature code is left.
        self.assertIsNone(parse(HEAD + "lou-20rc-ac8f1a6.bin"))
        self.assertIsNone(parse(HEAD + "lou-20rcx-ar-ac8f1a6.bin"))

    def test_old_names_carry_every_feature(self):
        self.assertEqual(parse("Heltec_v3_repeater_observer_mqtt-esp32s3-v1.17.1-ar-14-ac8f1a6.bin")["features"], "arrc")


if __name__ == "__main__":
    unittest.main()
